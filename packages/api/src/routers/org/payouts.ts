import { z } from 'zod'
import { and, eq, inArray } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

import { payoutAccounts, payouts, user } from '@ticketur/db'
import {
  MIN_PAYOUT_MINOR,
  OPEN_PAYOUT_STATUSES,
  formatNaira,
  loadOrganizerBalance,
  maskAccountNumber,
  newPayoutRowId,
  recordPayoutEvent,
  transitionPayout,
  type PayoutActor,
} from '@ticketur/db/payouts'
import { env } from '@ticketur/env/core'

import { createTRPCRouter, organizerProcedure } from '../../trpc'
import {
  getBanksCached,
  resolveBankAccount,
  type FlutterwaveBank,
} from '../../lib/flutterwave-accounts'
import { rateLimitStore } from '../../lib/rate-limit'
import {
  accountUsableFrom,
  assertCanManagePayouts,
  assertRequestsOpen,
  isUniqueViolation,
  loadActiveAccount,
  loadRecentPayouts,
  organizerAccountView,
  organizerPayoutView,
  payoutRules,
  payoutsMode,
} from '../../lib/payouts'
import {
  accountCodeContext,
  consumePayoutCode,
  issuePayoutCode,
  payoutCodeContext,
  verifyPayoutCode,
  type IssuePayoutCodeResult,
  type VerifyPayoutCodeResult,
} from '../../lib/payout-codes'
import {
  accountLine,
  notifyAdminsOfPayoutRequest,
  sendAccountChangedEmail,
  sendPayoutCodeEmail,
  sendPayoutUpdateEmail,
} from '../../lib/payout-emails'

// The organizer's Payouts page: what they have earned, what is on hold and
// until when, the bank account money goes to, and every withdrawal they have
// asked for — plus the three things they can do about it.
//
// ── How a withdrawal is protected ──
//   1. The bank account is real: Flutterwave names the holder, and the name
//      the organizer confirms is the one Flutterwave returned, re-fetched on
//      the server at save time rather than taken from the browser.
//   2. Adding or changing an account, and asking for a withdrawal, each need
//      a code emailed to the account's address, bound to that exact account
//      or amount (lib/payout-codes.ts).
//   3. A new account cannot receive money for 24 hours, and the organizer is
//      emailed whenever it changes.
//   4. The request copies the bank details, so a later change cannot
//      redirect it; an admin approves exactly what will be paid.
//   5. The balance is re-checked inside the transaction that writes the
//      request, under a lock on the account row, and the database refuses a
//      second open request outright.
//
// Reading is open to anyone the organizer procedure admits. Every write goes
// through assertCanManagePayouts: organizer accounts only, never while an
// admin is impersonating.

const bankCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{2,12}$/, 'Pick your bank from the list.')
const accountNumber = z
  .string()
  .transform((value) => value.replace(/\s+/g, ''))
  .pipe(z.string().regex(/^\d{10}$/, 'Account numbers are 10 digits.'))
const accountInput = z.object({ bankCode, accountNumber })
const code = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.')
// Kobo. The ceiling only keeps a typo out of integer overflow territory.
const amountMinor = z.number().int().positive().max(100_000_000_000)

/** A per-user brake on the calls that reach Flutterwave or send an email. */
function throttle(key: string, limitPerMinute: number): void {
  const decision = rateLimitStore.take(
    `payouts:${key}`,
    { limit: limitPerMinute, windowMs: 60_000 },
    Date.now()
  )
  if (!decision.allowed) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `Too many attempts. Wait ${decision.retryAfterSeconds} seconds and try again.`,
    })
  }
}

function bankUnavailable(): TRPCError {
  return new TRPCError({
    code: 'SERVICE_UNAVAILABLE',
    message: "We couldn't reach the bank just now. Try again in a minute.",
  })
}

/**
 * The bank and the holder's name for an account, from Flutterwave, or a
 * refusal the organizer can act on.
 */
async function resolveOrThrow(
  code: string,
  number: string
): Promise<{ bank: FlutterwaveBank; accountName: string }> {
  const banks = await getBanksCached({ secretKey: env.FLW_SECRET_KEY })
  if (banks.kind !== 'found') {
    console.error('[payouts] bank list unavailable', banks)
    throw bankUnavailable()
  }
  const bank = banks.banks.find((b) => b.code === code)
  if (!bank) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Pick your bank from the list.',
    })
  }
  const result = await resolveBankAccount({
    accountNumber: number,
    bankCode: code,
    secretKey: env.FLW_SECRET_KEY,
  })
  switch (result.kind) {
    case 'resolved':
      return { bank, accountName: result.accountName }
    case 'not_found':
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `We couldn't find account ${number} at ${bank.name}. Check the number and the bank.`,
      })
    case 'unauthorized':
      // Configuration, not the organizer: our key or this server's address
      // was refused. Loud, because every lookup will fail until it is fixed.
      console.error('[payouts] Flutterwave refused the account lookup', {
        httpStatus: result.httpStatus,
      })
      throw bankUnavailable()
    case 'unavailable':
      console.warn('[payouts] account lookup unavailable', {
        reason: result.reason,
      })
      throw bankUnavailable()
  }
}

function codeRefused(
  result: Extract<IssuePayoutCodeResult, { issued: false }>
): TRPCError {
  return new TRPCError({
    code: 'TOO_MANY_REQUESTS',
    message:
      result.reason === 'cooldown'
        ? `We've just sent you a code. Check your inbox (and spam), or ask again in ${result.retryAfterSeconds} seconds.`
        : 'Too many codes requested. Please try again later.',
  })
}

function codeFailed(
  result: Extract<VerifyPayoutCodeResult, { ok: false }>
): TRPCError {
  return new TRPCError({
    code: 'BAD_REQUEST',
    message:
      result.reason === 'wrong'
        ? "That code isn't right. Check the latest email we sent."
        : 'That code has expired or was already used. Ask for a new one.',
  })
}

function formatLagos(date: Date): string {
  return date.toLocaleString('en-NG', {
    timeZone: 'Africa/Lagos',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** Amount rules that do not need the balance. */
function assertAmountShape(value: number): void {
  if (value % 100 !== 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Withdrawals are in whole naira.',
    })
  }
  if (value < MIN_PAYOUT_MINOR) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `The smallest withdrawal is ${formatNaira(MIN_PAYOUT_MINOR)}.`,
    })
  }
}

function assertAccountReady(account: { createdAt: Date }, now: Date): void {
  const from = accountUsableFrom(account)
  if (from > now) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `For your security, a new bank account can receive money from ${formatLagos(from)}.`,
    })
  }
}

async function loadDisplayName(
  db: Parameters<typeof loadActiveAccount>[0],
  userId: string
): Promise<string> {
  const [row] = await db
    .select({ name: user.name, orgName: user.orgName })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  return row?.orgName?.trim() || row?.name || ''
}

export const orgPayoutsRouter = createTRPCRouter({
  overview: organizerProcedure.query(async ({ ctx }) => {
    const organizerId = ctx.session.user.id
    const mode = payoutsMode()
    const [summary, account, recent] = await Promise.all([
      loadOrganizerBalance(ctx.db, organizerId),
      loadActiveAccount(ctx.db, organizerId),
      loadRecentPayouts(ctx.db, organizerId),
    ])

    return {
      mode,
      // Whether this account may manage payouts at all (organizers only, and
      // only once payouts are switched on). The page hides what it cannot do
      // rather than offering buttons that refuse.
      canRequest: mode !== 'off' && ctx.session.user.role === 'organizer',
      hasOpenPayout: recent.some((p) =>
        (OPEN_PAYOUT_STATUSES as readonly string[]).includes(p.status)
      ),
      rules: payoutRules(),
      summary: {
        earnedMinor: summary.earnedMinor,
        heldMinor: summary.heldMinor,
        releasedMinor: summary.releasedMinor,
        adjustmentsMinor: summary.adjustmentsMinor,
        inProgressMinor: summary.inProgressMinor,
        paidOutMinor: summary.paidOutMinor,
        availableMinor: summary.availableMinor,
        withdrawableMinor: summary.withdrawableMinor,
        earlyRelease: summary.earlyRelease,
      },
      events: summary.events.map((e) => ({
        eventId: e.eventId,
        title: e.title,
        lastDay: e.lastDay,
        paidOrders: e.paidOrders,
        earnedMinor: e.earnedMinor,
        releaseDate: e.releaseDate,
        released: e.released,
      })),
      account: organizerAccountView(account),
      payouts: recent.map(organizerPayoutView),
    }
  }),

  /** The banks an organizer can pick from. */
  banks: organizerProcedure.query(async () => {
    const result = await getBanksCached({ secretKey: env.FLW_SECRET_KEY })
    if (result.kind !== 'found') {
      console.error('[payouts] bank list unavailable', result)
      throw bankUnavailable()
    }
    return result.banks
  }),

  /** Look an account up: who Flutterwave says holds it. Changes nothing. */
  resolveAccount: organizerProcedure
    .input(accountInput)
    .mutation(async ({ ctx, input }) => {
      assertCanManagePayouts(ctx.session)
      assertRequestsOpen(payoutsMode())
      throttle(`resolve:${ctx.session.user.id}`, 10)
      const { bank, accountName } = await resolveOrThrow(
        input.bankCode,
        input.accountNumber
      )
      return {
        bankName: bank.name,
        accountName,
        accountNumberMasked: maskAccountNumber(input.accountNumber),
      }
    }),

  /** Email the code that confirms adding this account. */
  requestAccountCode: organizerProcedure
    .input(accountInput)
    .mutation(async ({ ctx, input }) => {
      assertCanManagePayouts(ctx.session)
      assertRequestsOpen(payoutsMode())
      throttle(`code:${ctx.session.user.id}`, 5)
      const { bank, accountName } = await resolveOrThrow(
        input.bankCode,
        input.accountNumber
      )
      const issued = await issuePayoutCode(ctx.db, {
        userId: ctx.session.user.id,
        purpose: 'add_account',
        context: accountCodeContext(input.bankCode, input.accountNumber),
      })
      if (!issued.issued) throw codeRefused(issued)
      await sendPayoutCodeEmail({
        email: ctx.session.user.email,
        code: issued.code,
        purpose: 'add_account',
        detail: accountLine({
          bankName: bank.name,
          accountNumber: input.accountNumber,
          accountName,
        }),
      })
      return { bankName: bank.name, accountName, expiresAt: issued.expiresAt }
    }),

  /** Make this the account payouts go to. Needs the emailed code. */
  saveAccount: organizerProcedure
    .input(accountInput.extend({ code }))
    .mutation(async ({ ctx, input }) => {
      assertCanManagePayouts(ctx.session)
      assertRequestsOpen(payoutsMode())
      const organizerId = ctx.session.user.id

      const verified = await verifyPayoutCode(ctx.db, {
        userId: organizerId,
        purpose: 'add_account',
        context: accountCodeContext(input.bankCode, input.accountNumber),
        code: input.code,
      })
      if (!verified.ok) throw codeFailed(verified)

      // Fetched again, here, so the name stored is Flutterwave's — not
      // whatever a browser sent.
      const { bank, accountName } = await resolveOrThrow(
        input.bankCode,
        input.accountNumber
      )
      const now = new Date()

      let saved: { account: typeof payoutAccounts.$inferSelect; changed: boolean }
      try {
        saved = await ctx.db.transaction(async (tx) => {
          const [current] = await tx
            .select()
            .from(payoutAccounts)
            .where(
              and(
                eq(payoutAccounts.organizerId, organizerId),
                eq(payoutAccounts.status, 'active')
              )
            )
            .for('update')
            .limit(1)

          let account = current
          let changed = false
          if (
            !current ||
            current.bankCode !== input.bankCode ||
            current.accountNumber !== input.accountNumber
          ) {
            if (current) {
              await tx
                .update(payoutAccounts)
                .set({ status: 'retired', retiredAt: now })
                .where(eq(payoutAccounts.id, current.id))
            }
            const [created] = await tx
              .insert(payoutAccounts)
              .values({
                id: newPayoutRowId('pya'),
                organizerId,
                bankCode: input.bankCode,
                bankName: bank.name,
                accountNumber: input.accountNumber,
                accountName,
                status: 'active',
                createdAt: now,
              })
              .returning()
            account = created
            changed = true
          }

          if (!(await consumePayoutCode(tx, { codeId: verified.codeId, now }))) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'That code was already used. Ask for a new one.',
            })
          }
          return { account: account!, changed }
        })
      } catch (err) {
        if (isUniqueViolation(err, 'payout_accounts_one_active_idx')) {
          throw new TRPCError({
            code: 'CONFLICT',
            message:
              'Your bank account was just changed somewhere else. Reload the page.',
          })
        }
        throw err
      }

      if (saved.changed) {
        await sendAccountChangedEmail({
          email: ctx.session.user.email,
          name: ctx.session.user.name,
          account: saved.account,
          usableFrom: accountUsableFrom(saved.account),
        })
      }
      return organizerAccountView(saved.account)
    }),

  /** Email the code that confirms one withdrawal of exactly this amount. */
  requestPayoutCode: organizerProcedure
    .input(z.object({ amountMinor }))
    .mutation(async ({ ctx, input }) => {
      assertCanManagePayouts(ctx.session)
      assertRequestsOpen(payoutsMode())
      throttle(`code:${ctx.session.user.id}`, 5)
      const organizerId = ctx.session.user.id
      const now = new Date()

      const account = await loadActiveAccount(ctx.db, organizerId)
      if (!account) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Add a bank account first.',
        })
      }
      assertAccountReady(account, now)
      assertAmountShape(input.amountMinor)

      const [open] = await ctx.db
        .select({ id: payouts.id })
        .from(payouts)
        .where(
          and(
            eq(payouts.organizerId, organizerId),
            inArray(payouts.status, [...OPEN_PAYOUT_STATUSES])
          )
        )
        .limit(1)
      if (open) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            'You already have a withdrawal in progress. Wait for it to finish, or cancel it.',
        })
      }

      const summary = await loadOrganizerBalance(ctx.db, organizerId, { now })
      if (input.amountMinor > summary.withdrawableMinor) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `You can withdraw up to ${formatNaira(summary.withdrawableMinor)}.`,
        })
      }

      const issued = await issuePayoutCode(ctx.db, {
        userId: organizerId,
        purpose: 'request_payout',
        context: payoutCodeContext(input.amountMinor, account.id),
        now,
      })
      if (!issued.issued) throw codeRefused(issued)
      await sendPayoutCodeEmail({
        email: ctx.session.user.email,
        code: issued.code,
        purpose: 'request_payout',
        detail: `${formatNaira(input.amountMinor)} to ${accountLine(account)}`,
      })
      return { expiresAt: issued.expiresAt }
    }),

  /** Ask for a withdrawal. Needs the emailed code for this exact amount. */
  requestPayout: organizerProcedure
    .input(z.object({ amountMinor, code }))
    .mutation(async ({ ctx, input }) => {
      assertCanManagePayouts(ctx.session)
      assertRequestsOpen(payoutsMode())
      const organizerId = ctx.session.user.id
      assertAmountShape(input.amountMinor)

      const account = await loadActiveAccount(ctx.db, organizerId)
      if (!account) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Add a bank account first.',
        })
      }

      // On the pooled client, BEFORE the transaction: a spent guess must
      // survive a refused request.
      const verified = await verifyPayoutCode(ctx.db, {
        userId: organizerId,
        purpose: 'request_payout',
        context: payoutCodeContext(input.amountMinor, account.id),
        code: input.code,
      })
      if (!verified.ok) throw codeFailed(verified)

      const displayName = await loadDisplayName(ctx.db, organizerId)
      const actor: PayoutActor = {
        type: 'organizer',
        id: organizerId,
        name: displayName,
      }
      const now = new Date()

      let row: typeof payouts.$inferSelect
      try {
        row = await ctx.db.transaction(async (tx) => {
          // The lock every request for this organizer queues on.
          const [locked] = await tx
            .select()
            .from(payoutAccounts)
            .where(
              and(
                eq(payoutAccounts.id, account.id),
                eq(payoutAccounts.organizerId, organizerId),
                eq(payoutAccounts.status, 'active')
              )
            )
            .for('update')
            .limit(1)
          if (!locked) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Your bank account changed. Ask for a new code.',
            })
          }
          assertAccountReady(locked, now)

          const summary = await loadOrganizerBalance(tx, organizerId, { now })
          if (input.amountMinor > summary.withdrawableMinor) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `You can withdraw up to ${formatNaira(summary.withdrawableMinor)}.`,
            })
          }

          const id = newPayoutRowId('pyt')
          const [created] = await tx
            .insert(payouts)
            .values({
              id,
              organizerId,
              organizerName: displayName,
              organizerEmail: ctx.session.user.email,
              amountMinor: input.amountMinor,
              status: 'pending_review',
              accountId: locked.id,
              bankCode: locked.bankCode,
              bankName: locked.bankName,
              accountNumber: locked.accountNumber,
              accountName: locked.accountName,
              accountAddedAt: locked.createdAt,
              requestedAt: now,
              updatedAt: now,
            })
            .returning()
          await recordPayoutEvent(tx, {
            payoutId: id,
            fromStatus: null,
            toStatus: 'pending_review',
            actor,
            now,
          })
          if (!(await consumePayoutCode(tx, { codeId: verified.codeId, now }))) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'That code was already used. Ask for a new one.',
            })
          }
          return created!
        })
      } catch (err) {
        if (isUniqueViolation(err, 'payouts_one_open_per_organizer_idx')) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'You already have a withdrawal in progress.',
          })
        }
        throw err
      }

      await sendPayoutUpdateEmail('requested', row)
      await notifyAdminsOfPayoutRequest(ctx.db, row)
      return organizerPayoutView(row)
    }),

  /** Withdraw a request before anyone has reviewed it. */
  cancel: organizerProcedure
    .input(z.object({ payoutId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      assertCanManagePayouts(ctx.session)
      const organizerId = ctx.session.user.id
      const result = await ctx.db.transaction(async (tx) => {
        const [own] = await tx
          .select({ id: payouts.id })
          .from(payouts)
          .where(
            and(
              eq(payouts.id, input.payoutId),
              eq(payouts.organizerId, organizerId)
            )
          )
          .limit(1)
        if (!own) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Withdrawal not found' })
        }
        return transitionPayout(tx, {
          payoutId: input.payoutId,
          from: ['pending_review'],
          to: 'cancelled',
          actor: {
            type: 'organizer',
            id: organizerId,
            name: ctx.session.user.name,
          },
        })
      })
      if (!result.ok) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            'This withdrawal has already been reviewed, so it can no longer be cancelled.',
        })
      }
      return organizerPayoutView(result.payout)
    }),
})

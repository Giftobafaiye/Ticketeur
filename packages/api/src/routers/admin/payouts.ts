import { z } from 'zod'
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

import {
  payoutAccounts,
  payoutAdjustments,
  payoutEvents,
  payouts,
  payoutSettings,
  payoutTransfers,
  user,
  type PayoutStatus,
} from '@ticketur/db'
import {
  balanceCovers,
  formatNaira,
  isCommittedStatus,
  loadAllOrganizerBalances,
  loadOrganizerBalance,
  nameMatch,
  newPayoutRowId,
  transitionPayout,
  type DbTransaction,
  type PayoutActor,
  type PayoutRow,
} from '@ticketur/db/payouts'

import { adminProcedure, createTRPCRouter } from '../../trpc'
import {
  isUniqueViolation as isUniqueViolationError,
  payoutsMode,
} from '../../lib/payouts'
import { sendPayoutUpdateEmail } from '../../lib/payout-emails'
import { enqueuePayoutSend } from '../../lib/payout-transfers'

// The admin side of payouts: every organizer's balance, the adjustments that
// correct it, and the queue of withdrawals to decide.
//
// ── Why an admin can never act on their own balance ──
// Admins pass the organizer check elsewhere in the app, so an admin can own
// events. Approving your own withdrawal, crediting your own balance, or
// releasing your own earnings early is the one thing a reviewer must never be
// able to do to themselves.
//
// ── Every decision re-reads the row under a lock ──
// approve / reject / markPaid all lock the payout, re-check it against where
// it ACTUALLY is (via transitionPayout), and approve also re-checks the
// balance in the same transaction: a refund recorded since the request was
// made must stop the approval, not be discovered after the money left.

function assertNotSelf(adminId: string, organizerId: string): void {
  if (adminId === organizerId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You cannot change payouts for your own account.',
    })
  }
}

const organizerIdInput = z.object({ organizerId: z.string().min(1) })
const payoutIdInput = z.object({ id: z.string().min(1) })

const LIST_FILTERS = [
  'needs_action',
  'pending_review',
  'approved',
  'processing',
  'failed',
  'paid',
  'closed',
  'all',
] as const

function statusFilter(filter: (typeof LIST_FILTERS)[number]) {
  switch (filter) {
    case 'needs_action':
      return inArray(payouts.status, ['pending_review', 'approved', 'failed'])
    case 'closed':
      return inArray(payouts.status, ['rejected', 'cancelled'])
    case 'all':
      return undefined
    default:
      return eq(payouts.status, filter)
  }
}

/** The queue's filter, shared by the list and the export so they agree. */
function queueWhere(filter: (typeof LIST_FILTERS)[number], q: string) {
  const filters = [statusFilter(filter)]
  const needle = q.trim()
  if (needle) {
    const like = `%${needle}%`
    filters.push(
      or(
        ilike(payouts.organizerName, like),
        ilike(payouts.organizerEmail, like),
        ilike(payouts.accountName, like),
        ilike(payouts.accountNumber, like)
      )
    )
  }
  return and(...filters)
}

function adminActor(session: { user: { id: string; name: string } }): PayoutActor {
  return { type: 'admin', id: session.user.id, name: session.user.name }
}

/** Lock a payout for a decision, refusing an admin's own. */
async function lockForDecision(
  tx: DbTransaction,
  id: string,
  adminId: string
): Promise<PayoutRow> {
  const [row] = await tx
    .select()
    .from(payouts)
    .where(eq(payouts.id, id))
    .for('update')
    .limit(1)
  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Payout not found' })
  }
  assertNotSelf(adminId, row.organizerId)
  return row
}

const STATUS_WORDS: Record<PayoutStatus, string> = {
  pending_review: 'waiting for review',
  approved: 'approved',
  processing: 'being sent',
  paid: 'paid',
  failed: 'failed',
  rejected: 'rejected',
  cancelled: 'cancelled by the organizer',
}

function wrongStatus(status: PayoutStatus): TRPCError {
  return new TRPCError({
    code: 'CONFLICT',
    message: `This payout is ${STATUS_WORDS[status]} — someone else may have just acted on it. Reload.`,
  })
}

export const adminPayoutsRouter = createTRPCRouter({
  /**
   * Every payout matching a filter, for the accounting export (CSV, built in
   * the browser). Oldest first, with the reference that proves each payment:
   * the one typed for a payment by hand, or the successful transfer's.
   */
  exportRows: adminProcedure
    .input(
      z.object({
        status: z.enum(LIST_FILTERS).default('all'),
        q: z.string().default(''),
      })
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(payouts)
        .where(queueWhere(input.status, input.q))
        .orderBy(asc(payouts.requestedAt))
        .limit(5000)
      const ids = rows.map((r) => r.id)
      const transfers = ids.length
        ? await ctx.db
            .select({
              payoutId: payoutTransfers.payoutId,
              reference: payoutTransfers.reference,
              status: payoutTransfers.status,
              flwTransferId: payoutTransfers.flwTransferId,
              feeMinor: payoutTransfers.feeMinor,
            })
            .from(payoutTransfers)
            .where(inArray(payoutTransfers.payoutId, ids))
        : []
      const successful = new Map(
        transfers
          .filter((t) => t.status === 'successful')
          .map((t) => [t.payoutId, t])
      )
      return rows.map((p) => {
        const t = successful.get(p.id)
        return {
          id: p.id,
          requestedAt: p.requestedAt,
          organizerName: p.organizerName,
          organizerEmail: p.organizerEmail,
          amountMinor: p.amountMinor,
          status: p.status,
          method: p.method,
          bankName: p.bankName,
          accountNumber: p.accountNumber,
          accountName: p.accountName,
          reviewedByName: p.reviewedByName,
          paidAt: p.paidAt,
          reference: p.manualReference || t?.reference || '',
          flwTransferId: t?.flwTransferId ?? '',
          transferFeeMinor: t?.feeMinor ?? null,
        }
      })
    }),

  /** The withdrawal queue. "Needs action" is oldest first: first come, first paid. */
  list: adminProcedure
    .input(
      z.object({
        status: z.enum(LIST_FILTERS).default('needs_action'),
        q: z.string().default(''),
        page: z.number().int().positive().default(1),
        pageSize: z.number().int().positive().max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = queueWhere(input.status, input.q)
      const order =
        input.status === 'needs_action'
          ? asc(payouts.requestedAt)
          : desc(payouts.requestedAt)

      const [rows, totalRow] = await Promise.all([
        ctx.db
          .select()
          .from(payouts)
          .where(where)
          .orderBy(order)
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        ctx.db.select({ n: count(payouts.id) }).from(payouts).where(where),
      ])

      return {
        rows: rows.map((p) => ({
          id: p.id,
          organizerId: p.organizerId,
          organizerName: p.organizerName,
          organizerEmail: p.organizerEmail,
          amountMinor: p.amountMinor,
          status: p.status,
          method: p.method,
          bankName: p.bankName,
          accountNumber: p.accountNumber,
          accountName: p.accountName,
          requestedAt: p.requestedAt,
          paidAt: p.paidAt,
        })),
        total: Number(totalRow[0]?.n ?? 0),
      }
    }),

  /** One request with everything a reviewer needs to decide it. */
  byId: adminProcedure.input(payoutIdInput).query(async ({ ctx, input }) => {
    const [p] = await ctx.db
      .select()
      .from(payouts)
      .where(eq(payouts.id, input.id))
      .limit(1)
    if (!p) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Payout not found' })
    }

    const [[profile], summary, transfers, history] = await Promise.all([
      ctx.db
        .select({
          name: user.name,
          orgName: user.orgName,
          email: user.email,
          role: user.role,
        })
        .from(user)
        .where(eq(user.id, p.organizerId))
        .limit(1),
      loadOrganizerBalance(ctx.db, p.organizerId),
      ctx.db
        .select()
        .from(payoutTransfers)
        .where(eq(payoutTransfers.payoutId, p.id))
        .orderBy(asc(payoutTransfers.attempt)),
      ctx.db
        .select()
        .from(payoutEvents)
        .where(eq(payoutEvents.payoutId, p.id))
        .orderBy(asc(payoutEvents.createdAt)),
    ])

    const mode = payoutsMode()
    const isSelf = p.organizerId === ctx.session.user.id
    const latest = transfers[transfers.length - 1]

    return {
      payout: p,
      profile: profile
        ? {
            name: profile.name,
            orgName: profile.orgName ?? '',
            email: profile.email,
            role: profile.role ?? 'attendee',
          }
        : null,
      isSelf,
      mode,
      nameMatch: nameMatch(p.accountName, [profile?.name, profile?.orgName]),
      // How old the bank account was when this was asked for.
      accountAgeHours: p.accountAddedAt
        ? Math.floor(
            (p.requestedAt.getTime() - p.accountAddedAt.getTime()) / 3_600_000
          )
        : null,
      balance: {
        availableMinor: summary.availableMinor,
        withdrawableMinor: summary.withdrawableMinor,
        heldMinor: summary.heldMinor,
        inProgressMinor: summary.inProgressMinor,
        paidOutMinor: summary.paidOutMinor,
        adjustmentsMinor: summary.adjustmentsMinor,
        earnedMinor: summary.earnedMinor,
      },
      covers: balanceCovers(summary, p.amountMinor, isCommittedStatus(p.status)),
      transfers: transfers.map((t) => ({
        id: t.id,
        attempt: t.attempt,
        reference: t.reference,
        flwTransferId: t.flwTransferId,
        status: t.status,
        feeMinor: t.feeMinor,
        completeMessage: t.completeMessage,
        lastError: t.lastError,
        createdAt: t.createdAt,
        lastCheckedAt: t.lastCheckedAt,
        completedAt: t.completedAt,
      })),
      history: history.map((h) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        actorType: h.actorType,
        actorName: h.actorName,
        note: h.note,
        createdAt: h.createdAt,
      })),
      actions: {
        canApprove: !isSelf && mode !== 'off' && p.status === 'pending_review',
        canReject:
          !isSelf &&
          (['pending_review', 'approved', 'failed'] as PayoutStatus[]).includes(
            p.status
          ),
        canMarkPaid:
          !isSelf &&
          (['approved', 'failed'] as PayoutStatus[]).includes(p.status),
        canRetry: !isSelf && mode === 'live' && p.status === 'failed',
        // A transfer whose outcome never arrived: a person checks the
        // Flutterwave dashboard and says what it shows.
        canResolveUnconfirmed:
          !isSelf &&
          p.status === 'processing' &&
          latest?.status === 'unconfirmed',
      },
    }
  }),

  /** Approve a request. In `live` mode the transfer job then sends it. */
  approve: adminProcedure.input(payoutIdInput).mutation(async ({ ctx, input }) => {
    const mode = payoutsMode()
    if (mode === 'off') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Payouts are switched off (PAYOUTS_MODE=off).',
      })
    }
    const now = new Date()
    const approved = await ctx.db.transaction(async (tx) => {
      const row = await lockForDecision(tx, input.id, ctx.session.user.id)
      if (row.status !== 'pending_review') throw wrongStatus(row.status)
      const summary = await loadOrganizerBalance(tx, row.organizerId, { now })
      if (!balanceCovers(summary, row.amountMinor, true)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `The organizer's balance no longer covers this: ${formatNaira(summary.availableMinor)} after it. Something changed since the request — reject it, or record the change first.`,
        })
      }
      const moved = await transitionPayout(tx, {
        payoutId: row.id,
        from: ['pending_review'],
        to: 'approved',
        actor: adminActor(ctx.session),
        set: {
          reviewedBy: ctx.session.user.id,
          reviewedByName: ctx.session.user.name,
          reviewedAt: now,
        },
        now,
      })
      if (!moved.ok) {
        throw moved.reason === 'wrong_status'
          ? wrongStatus(moved.status)
          : new TRPCError({ code: 'NOT_FOUND', message: 'Payout not found' })
      }
      return moved.payout
    })

    await sendPayoutUpdateEmail('approved', approved)
    // In `live` mode the worker sends it. A lost enqueue is not lost money:
    // the reconcile-payouts sweep sends anything left approved.
    if (mode === 'live') await enqueuePayoutSend(approved.id)
    return { ok: true as const, mode }
  }),

  /**
   * Send a payout whose last transfer definitively FAILED again, as a new
   * attempt with a new reference. Only from 'failed' — never from an attempt
   * whose outcome is unknown; that one is resolved below, by a person.
   */
  retry: adminProcedure.input(payoutIdInput).mutation(async ({ ctx, input }) => {
    if (payoutsMode() !== 'live') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'Automatic transfers are off. Pay it by hand and mark it paid, or set PAYOUTS_MODE=live.',
      })
    }
    const now = new Date()
    const approved = await ctx.db.transaction(async (tx) => {
      const row = await lockForDecision(tx, input.id, ctx.session.user.id)
      if (row.status !== 'failed') throw wrongStatus(row.status)
      // Failure released the amount, so it has to fit on top again.
      const summary = await loadOrganizerBalance(tx, row.organizerId, { now })
      if (!balanceCovers(summary, row.amountMinor, false)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `The organizer's balance no longer covers this (${formatNaira(summary.availableMinor)} available).`,
        })
      }
      const moved = await transitionPayout(tx, {
        payoutId: row.id,
        from: ['failed'],
        to: 'approved',
        actor: adminActor(ctx.session),
        set: { failureReason: '' },
        note: 'Retry',
        now,
      })
      if (!moved.ok) {
        throw moved.reason === 'wrong_status'
          ? wrongStatus(moved.status)
          : new TRPCError({ code: 'NOT_FOUND', message: 'Payout not found' })
      }
      return moved.payout
    }).catch((err: unknown) => {
      if (isUniqueViolationError(err)) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            'This organizer already has another withdrawal in progress. Finish that one first.',
        })
      }
      throw err
    })
    await enqueuePayoutSend(approved.id)
    return { ok: true as const }
  }),

  /**
   * A transfer whose outcome never arrived: the create call timed out, and
   * Flutterwave has not (yet) shown it to a lookup. Only a person looking at
   * the Flutterwave dashboard can settle it:
   *
   *   paid      the dashboard shows the transfer succeeded
   *   not_sent  the dashboard has no transfer with this reference
   *
   * `not_sent` frees the payout for a retry. Getting it wrong is how money is
   * paid twice, which is why it needs the reference typed back.
   */
  resolveUnconfirmed: adminProcedure
    .input(
      payoutIdInput.extend({
        outcome: z.enum(['paid', 'not_sent']),
        // The attempt's reference, typed back as proof it was looked up.
        reference: z.string().trim().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date()
      const result = await ctx.db.transaction(async (tx) => {
        const row = await lockForDecision(tx, input.id, ctx.session.user.id)
        if (row.status !== 'processing') throw wrongStatus(row.status)
        const [attempt] = await tx
          .select()
          .from(payoutTransfers)
          .where(eq(payoutTransfers.payoutId, row.id))
          .orderBy(desc(payoutTransfers.attempt))
          .for('update')
          .limit(1)
        if (!attempt || attempt.status !== 'unconfirmed') {
          throw new TRPCError({
            code: 'CONFLICT',
            message:
              'This transfer is not waiting for confirmation any more. Reload.',
          })
        }
        if (attempt.reference !== input.reference) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'That is not this transfer’s reference.',
          })
        }
        const paid = input.outcome === 'paid'
        await tx
          .update(payoutTransfers)
          .set({
            status: paid ? 'successful' : 'failed',
            completeMessage: paid
              ? `Confirmed successful in the Flutterwave dashboard by ${ctx.session.user.name}`
              : `Confirmed not sent (no such transfer in the Flutterwave dashboard) by ${ctx.session.user.name}`,
            completedAt: now,
            updatedAt: now,
          })
          .where(eq(payoutTransfers.id, attempt.id))
        const moved = await transitionPayout(tx, {
          payoutId: row.id,
          from: ['processing'],
          to: paid ? 'paid' : 'failed',
          actor: adminActor(ctx.session),
          set: paid
            ? { method: 'transfer', paidAt: now, failureReason: '' }
            : {
                failureReason:
                  'The transfer never reached Flutterwave (confirmed by an admin).',
              },
          note: paid
            ? `Confirmed paid from the Flutterwave dashboard (${attempt.reference})`
            : `Confirmed not sent (${attempt.reference})`,
          now,
        })
        if (!moved.ok) {
          throw moved.reason === 'wrong_status'
            ? wrongStatus(moved.status)
            : new TRPCError({ code: 'NOT_FOUND', message: 'Payout not found' })
        }
        return { payout: moved.payout, paid, reference: attempt.reference }
      })
      if (result.paid) {
        await sendPayoutUpdateEmail('paid', result.payout, {
          reference: result.reference,
        })
      }
      return { ok: true as const }
    }),

  /** Turn a request down. The amount goes back on the organizer's balance. */
  reject: adminProcedure
    .input(payoutIdInput.extend({ reason: z.string().trim().min(3).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date()
      const rejected = await ctx.db.transaction(async (tx) => {
        const row = await lockForDecision(tx, input.id, ctx.session.user.id)
        const moved = await transitionPayout(tx, {
          payoutId: row.id,
          from: ['pending_review', 'approved', 'failed'],
          to: 'rejected',
          actor: adminActor(ctx.session),
          set: {
            rejectionReason: input.reason,
            reviewedBy: ctx.session.user.id,
            reviewedByName: ctx.session.user.name,
            reviewedAt: now,
          },
          note: input.reason,
          now,
        })
        if (!moved.ok) {
          throw moved.reason === 'wrong_status'
            ? wrongStatus(moved.status)
            : new TRPCError({ code: 'NOT_FOUND', message: 'Payout not found' })
        }
        return moved.payout
      })
      await sendPayoutUpdateEmail('rejected', rejected, { reason: input.reason })
      return { ok: true as const }
    }),

  /**
   * Record that the money was sent by hand (the Flutterwave dashboard, a bank
   * app). Only from approved or failed — never while a transfer is in flight,
   * because that one might still land and pay the organizer twice.
   */
  markPaid: adminProcedure
    .input(
      payoutIdInput.extend({
        reference: z.string().trim().min(2).max(120),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date()
      const paid = await ctx.db.transaction(async (tx) => {
        const row = await lockForDecision(tx, input.id, ctx.session.user.id)
        const moved = await transitionPayout(tx, {
          payoutId: row.id,
          from: ['approved', 'failed'],
          to: 'paid',
          actor: adminActor(ctx.session),
          set: {
            method: 'manual',
            manualReference: input.reference,
            paidAt: now,
            failureReason: '',
          },
          note: `Paid by hand, reference ${input.reference}`,
          now,
        })
        if (!moved.ok) {
          throw moved.reason === 'wrong_status'
            ? wrongStatus(moved.status)
            : new TRPCError({ code: 'NOT_FOUND', message: 'Payout not found' })
        }
        return moved.payout
      })
      await sendPayoutUpdateEmail('paid', paid, { reference: input.reference })
      return { ok: true as const }
    }),
  /** The headline numbers, and the count the sidebar badge shows. */
  stats: adminProcedure.query(async ({ ctx }) => {
    const [byStatus, balances] = await Promise.all([
      ctx.db
        .select({
          status: payouts.status,
          n: count(payouts.id),
          totalMinor: sql<string>`coalesce(sum(${payouts.amountMinor}), 0)`,
        })
        .from(payouts)
        .groupBy(payouts.status),
      loadAllOrganizerBalances(ctx.db),
    ])

    const n = (status: string) =>
      Number(byStatus.find((r) => r.status === status)?.n ?? 0)
    const total = (status: string) =>
      Number(byStatus.find((r) => r.status === status)?.totalMinor ?? 0)

    let availableMinor = 0
    let heldMinor = 0
    for (const b of balances) {
      availableMinor += Math.max(0, b.summary.availableMinor)
      heldMinor += b.summary.heldMinor
    }

    return {
      mode: payoutsMode(),
      awaitingReview: n('pending_review'),
      approved: n('approved'),
      processing: n('processing'),
      failed: n('failed'),
      // Needs a person: review, payment by hand, or a failed transfer.
      needsAction: n('pending_review') + n('approved') + n('failed'),
      inProgressMinor:
        total('pending_review') + total('approved') + total('processing'),
      paidOutMinor: total('paid'),
      // What organizers could ask for right now, and what is still on hold.
      availableMinor,
      heldMinor,
    }
  }),

  /** Every organizer with earnings, payouts or adjustments. */
  balances: adminProcedure.query(async ({ ctx }) => {
    const balances = await loadAllOrganizerBalances(ctx.db)
    const ids = balances.map((b) => b.organizerId)
    const profiles = ids.length
      ? await ctx.db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            orgName: user.orgName,
          })
          .from(user)
          .where(inArray(user.id, ids))
      : []
    const byId = new Map(profiles.map((p) => [p.id, p]))

    return balances.map(({ organizerId, summary }) => {
      const p = byId.get(organizerId)
      return {
        organizerId,
        // A soft-pointed organizer whose account was deleted still shows,
        // so money owed or paid to them stays visible.
        name: p?.orgName?.trim() || p?.name || 'Deleted account',
        email: p?.email ?? '',
        exists: Boolean(p),
        earnedMinor: summary.earnedMinor,
        heldMinor: summary.heldMinor,
        availableMinor: summary.availableMinor,
        withdrawableMinor: summary.withdrawableMinor,
        inProgressMinor: summary.inProgressMinor,
        paidOutMinor: summary.paidOutMinor,
        adjustmentsMinor: summary.adjustmentsMinor,
        earlyRelease: summary.earlyRelease,
      }
    })
  }),

  /** One organizer: the balance line by line, adjustments, payouts, accounts. */
  organizer: adminProcedure
    .input(organizerIdInput)
    .query(async ({ ctx, input }) => {
      const [profile] = await ctx.db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          orgName: user.orgName,
          role: user.role,
        })
        .from(user)
        .where(eq(user.id, input.organizerId))
        .limit(1)

      const [summary, adjustments, payoutRows, accounts] = await Promise.all([
        loadOrganizerBalance(ctx.db, input.organizerId),
        ctx.db
          .select()
          .from(payoutAdjustments)
          .where(eq(payoutAdjustments.organizerId, input.organizerId))
          .orderBy(desc(payoutAdjustments.createdAt)),
        ctx.db
          .select()
          .from(payouts)
          .where(eq(payouts.organizerId, input.organizerId))
          .orderBy(desc(payouts.requestedAt))
          .limit(100),
        ctx.db
          .select()
          .from(payoutAccounts)
          .where(eq(payoutAccounts.organizerId, input.organizerId))
          .orderBy(desc(payoutAccounts.createdAt)),
      ])

      if (!profile && summary.earnedMinor === 0 && payoutRows.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Organizer not found' })
      }

      return {
        organizerId: input.organizerId,
        profile: profile
          ? {
              name: profile.name,
              orgName: profile.orgName ?? '',
              email: profile.email,
              role: profile.role ?? 'attendee',
            }
          : null,
        isSelf: input.organizerId === ctx.session.user.id,
        summary,
        adjustments: adjustments.map((a) => ({
          id: a.id,
          amountMinor: a.amountMinor,
          kind: a.kind,
          reason: a.reason,
          createdByName: a.createdByName,
          createdAt: a.createdAt,
        })),
        payouts: payoutRows.map((p) => ({
          id: p.id,
          amountMinor: p.amountMinor,
          status: p.status,
          method: p.method,
          bankName: p.bankName,
          accountNumber: p.accountNumber,
          requestedAt: p.requestedAt,
          paidAt: p.paidAt,
        })),
        accounts: accounts.map((a) => ({
          id: a.id,
          bankName: a.bankName,
          accountNumber: a.accountNumber,
          accountName: a.accountName,
          status: a.status,
          createdAt: a.createdAt,
          retiredAt: a.retiredAt,
        })),
      }
    }),

  /**
   * Correct an organizer's balance. Append-only: a mistake is undone by
   * another adjustment, never by editing this one.
   *
   * `paid_outside` records money already handed over outside this system —
   * the payments made by hand before payouts existed — and always reduces the
   * balance. `correction` goes either way.
   */
  addAdjustment: adminProcedure
    .input(
      z.object({
        organizerId: z.string().min(1),
        kind: z.enum(['paid_outside', 'correction']),
        direction: z.enum(['credit', 'debit']),
        // Kobo, positive; the direction gives the sign.
        amountMinor: z
          .number()
          .int()
          .positive()
          .max(100_000_000_000),
        reason: z.string().trim().min(3).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertNotSelf(ctx.session.user.id, input.organizerId)
      if (input.kind === 'paid_outside' && input.direction !== 'debit') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Money paid outside the platform can only reduce a balance.',
        })
      }

      const [exists] = await ctx.db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, input.organizerId))
        .limit(1)
      if (!exists) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Organizer not found' })
      }

      const signed =
        input.direction === 'debit' ? -input.amountMinor : input.amountMinor
      await ctx.db.insert(payoutAdjustments).values({
        id: newPayoutRowId('pyadj'),
        organizerId: input.organizerId,
        amountMinor: signed,
        kind: input.kind,
        reason: input.reason,
        createdBy: ctx.session.user.id,
        createdByName: ctx.session.user.name,
        createdByEmail: ctx.session.user.email,
      })
      return { ok: true as const }
    }),

  /** Let an organizer withdraw as soon as money is paid, not after the event. */
  setEarlyRelease: adminProcedure
    .input(organizerIdInput.extend({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      assertNotSelf(ctx.session.user.id, input.organizerId)
      await ctx.db
        .insert(payoutSettings)
        .values({
          organizerId: input.organizerId,
          earlyRelease: input.enabled,
          updatedBy: ctx.session.user.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: payoutSettings.organizerId,
          set: {
            earlyRelease: input.enabled,
            updatedBy: ctx.session.user.id,
            updatedAt: new Date(),
          },
        })
      return { ok: true as const }
    }),

  /**
   * Requests waiting on a person — to review, to pay by hand, or a transfer
   * that failed — for the sidebar badge. One indexed count, on every page.
   * 'processing' is left out: that one is waiting on Flutterwave, not on us.
   */
  openCount: adminProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({ n: count(payouts.id) })
      .from(payouts)
      .where(inArray(payouts.status, ['pending_review', 'approved', 'failed']))
    return { count: Number(row?.n ?? 0) }
  }),
})

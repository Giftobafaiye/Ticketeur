import { and, desc, eq } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

import type { Session } from '@ticketur/auth'
import { payoutAccounts, payouts, type PayoutStatus } from '@ticketur/db'
import {
  MIN_PAYOUT_MINOR,
  NEW_ACCOUNT_COOLDOWN_MS,
  PAYOUT_HOLD_DAYS,
  maskAccountNumber,
  type DbExecutor,
  type PayoutMode,
} from '@ticketur/db/payouts'
import { env } from '@ticketur/env/core'

// What the payout routers share: the mode switch, the guards, and the shapes
// a payout is shown in. The rules and the balance live in @ticketur/db/payouts
// so the Trigger.dev worker reads the same ones.

/** env PAYOUTS_MODE, read per call so a test can change it. */
export function payoutsMode(): PayoutMode {
  return env.PAYOUTS_MODE
}

/** Whether this session is an admin signed in as someone else. */
export function isImpersonated(session: NonNullable<Session>): boolean {
  const by = (session.session as { impersonatedBy?: string | null })
    .impersonatedBy
  return typeof by === 'string' && by.length > 0
}

/**
 * The guard on every payout WRITE an organizer makes: adding a bank account,
 * asking for a withdrawal, cancelling one.
 *
 *  - Organizer accounts only. `organizerProcedure` also lets admins through
 *    (they can act as organizers elsewhere), but an admin withdrawing would
 *    be approving money to themselves.
 *  - Never while impersonating. An admin signed in as an organizer could
 *    otherwise swap that organizer's bank account and approve the payout.
 */
export function assertCanManagePayouts(session: NonNullable<Session>): void {
  if (session.user.role !== 'organizer') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Only organizer accounts can withdraw earnings.',
    })
  }
  if (isImpersonated(session)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message:
        'Payout details cannot be changed while signed in as another user.',
    })
  }
}

/** The mode has to allow requests at all. */
export function assertRequestsOpen(mode: PayoutMode): void {
  if (mode === 'off') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Withdrawals are not open yet.',
    })
  }
}

export type ActiveAccount = typeof payoutAccounts.$inferSelect

export async function loadActiveAccount(
  db: DbExecutor,
  organizerId: string
): Promise<ActiveAccount | null> {
  const [row] = await db
    .select()
    .from(payoutAccounts)
    .where(
      and(
        eq(payoutAccounts.organizerId, organizerId),
        eq(payoutAccounts.status, 'active')
      )
    )
    .limit(1)
  return row ?? null
}

/** When a newly added account may first receive a payout. */
export function accountUsableFrom(account: { createdAt: Date }): Date {
  return new Date(account.createdAt.getTime() + NEW_ACCOUNT_COOLDOWN_MS)
}

/** The account as the organizer sees it: masked, with its cool-down. */
export function organizerAccountView(account: ActiveAccount | null) {
  if (!account) return null
  return {
    id: account.id,
    bankName: account.bankName,
    bankCode: account.bankCode,
    accountNumberMasked: maskAccountNumber(account.accountNumber),
    accountName: account.accountName,
    addedAt: account.createdAt,
    usableFrom: accountUsableFrom(account),
  }
}

/** The rules, for display. */
export function payoutRules() {
  return {
    minPayoutMinor: MIN_PAYOUT_MINOR,
    holdDays: PAYOUT_HOLD_DAYS,
    cooldownHours: NEW_ACCOUNT_COOLDOWN_MS / 3_600_000,
  }
}

export type PayoutRow = typeof payouts.$inferSelect

// What an organizer is told about a payout. Admin-only detail (who reviewed
// it, Flutterwave's raw failure text) stays out: a failure is described in
// terms the organizer can act on, and the admin sees the rest.
const ORGANIZER_STATUS_NOTE: Partial<Record<PayoutStatus, string>> = {
  pending_review: 'Waiting for review.',
  approved: 'Approved. The money is on its way.',
  processing: 'Being sent to your bank.',
  failed:
    'The transfer did not go through. We will retry or contact you — check your bank details are still right.',
}

export function organizerPayoutView(row: PayoutRow) {
  return {
    id: row.id,
    amountMinor: row.amountMinor,
    status: row.status,
    bankName: row.bankName,
    accountNumberMasked: maskAccountNumber(row.accountNumber),
    accountName: row.accountName,
    requestedAt: row.requestedAt,
    reviewedAt: row.reviewedAt,
    paidAt: row.paidAt,
    note:
      row.status === 'rejected'
        ? row.rejectionReason
        : (ORGANIZER_STATUS_NOTE[row.status] ?? ''),
    canCancel: row.status === 'pending_review',
  }
}

export async function loadRecentPayouts(
  db: DbExecutor,
  organizerId: string,
  limit = 20
): Promise<PayoutRow[]> {
  return db
    .select()
    .from(payouts)
    .where(eq(payouts.organizerId, organizerId))
    .orderBy(desc(payouts.requestedAt))
    .limit(limit)
}

/**
 * Postgres' unique-violation code, for turning the one-open-request index
 * into a sentence instead of a 500.
 */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const e = err as { code?: string; constraint_name?: string; cause?: unknown }
  const inner = (e?.cause ?? e) as { code?: string; constraint_name?: string }
  if (inner?.code !== '23505') return false
  return constraint ? inner.constraint_name === constraint : true
}

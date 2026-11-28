import { eq } from 'drizzle-orm'

import type { Database } from '../client'
import {
  payoutEvents,
  payouts,
  type PayoutActorType,
  type PayoutStatus,
} from '../schema/payouts'

import { COMMITTED_PAYOUT_STATUSES, OPEN_PAYOUT_STATUSES } from './constants'
import { newPayoutRowId } from './references'

// The payout state machine, and the one function that moves a payout between
// states. Every writer — the organizer cancelling, an admin deciding, the
// transfer job settling — goes through `transitionPayout`, which locks the
// row, checks the move is allowed from where the row ACTUALLY is, applies it
// and records who did it. Two actors racing for the same payout (an admin
// marking it paid by hand while the job claims it) therefore serialise on the
// row lock, and exactly one of them wins.

export type DbTransaction = Parameters<
  Parameters<Database['transaction']>[0]
>[0]
export type DbExecutor = Database | DbTransaction

/**
 * Every allowed move.
 *
 *   pending_review → approved | rejected | cancelled
 *   approved       → processing (job sends it) | paid (by hand) | rejected
 *   processing     → paid | failed
 *   failed         → approved (retry) | paid (by hand) | rejected
 *   paid, rejected, cancelled: terminal
 *
 * Deliberately absent: processing → anything an admin chooses freely. A
 * payout in flight is settled by Flutterwave's answer, or — when that answer
 * never came — by an admin confirming what the Flutterwave dashboard shows,
 * which still lands on paid or failed.
 */
export const PAYOUT_TRANSITIONS: Record<PayoutStatus, readonly PayoutStatus[]> =
  {
    pending_review: ['approved', 'rejected', 'cancelled'],
    approved: ['processing', 'paid', 'rejected'],
    processing: ['paid', 'failed'],
    failed: ['approved', 'paid', 'rejected'],
    paid: [],
    rejected: [],
    cancelled: [],
  }

export function canTransition(from: PayoutStatus, to: PayoutStatus): boolean {
  return PAYOUT_TRANSITIONS[from].includes(to)
}

const OPEN = new Set<PayoutStatus>(OPEN_PAYOUT_STATUSES)
const COMMITTED = new Set<PayoutStatus>(COMMITTED_PAYOUT_STATUSES)

/** Still in motion: counts toward the one-open-request limit. */
export function isOpenStatus(status: PayoutStatus): boolean {
  return OPEN.has(status)
}

/** Holding money off the organizer's balance. */
export function isCommittedStatus(status: PayoutStatus): boolean {
  return COMMITTED.has(status)
}

export type PayoutActor = {
  type: PayoutActorType
  id: string | null
  name: string
}

export const SYSTEM_ACTOR: PayoutActor = {
  type: 'system',
  id: null,
  name: 'Payout job',
}

export type PayoutRow = typeof payouts.$inferSelect

export type TransitionResult =
  | { ok: true; payout: PayoutRow; from: PayoutStatus }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'wrong_status'; status: PayoutStatus }

/**
 * Move one payout to `to`, if it is currently in one of `from` and the state
 * machine allows the move. Locks the row (`FOR UPDATE`), so it MUST run inside
 * a transaction — which is also what makes the event row commit with the
 * change it describes.
 *
 * `set` carries the columns that change with the move (reviewer, reason,
 * paid-at…); status and updated_at are set here.
 */
export async function transitionPayout(
  tx: DbTransaction,
  args: {
    payoutId: string
    from: readonly PayoutStatus[]
    to: PayoutStatus
    actor: PayoutActor
    set?: Partial<Omit<typeof payouts.$inferInsert, 'id' | 'status'>>
    note?: string
    now?: Date
  }
): Promise<TransitionResult> {
  const now = args.now ?? new Date()
  const [current] = await tx
    .select({ status: payouts.status })
    .from(payouts)
    .where(eq(payouts.id, args.payoutId))
    .for('update')
    .limit(1)
  if (!current) return { ok: false, reason: 'not_found' }
  if (!args.from.includes(current.status) || !canTransition(current.status, args.to)) {
    return { ok: false, reason: 'wrong_status', status: current.status }
  }

  const [row] = await tx
    .update(payouts)
    .set({ ...args.set, status: args.to, updatedAt: now })
    .where(eq(payouts.id, args.payoutId))
    .returning()
  if (!row) return { ok: false, reason: 'not_found' }

  await recordPayoutEvent(tx, {
    payoutId: args.payoutId,
    fromStatus: current.status,
    toStatus: args.to,
    actor: args.actor,
    note: args.note ?? '',
    now,
  })
  return { ok: true, payout: row, from: current.status }
}

/** Append one history row. Used directly only for a payout's creation. */
export async function recordPayoutEvent(
  tx: DbExecutor,
  args: {
    payoutId: string
    fromStatus: PayoutStatus | null
    toStatus: PayoutStatus
    actor: PayoutActor
    note?: string
    now?: Date
  }
): Promise<void> {
  await tx.insert(payoutEvents).values({
    id: newPayoutRowId('pyev'),
    payoutId: args.payoutId,
    fromStatus: args.fromStatus,
    toStatus: args.toStatus,
    actorType: args.actor.type,
    actorId: args.actor.id,
    actorName: args.actor.name,
    note: args.note ?? '',
    createdAt: args.now ?? new Date(),
  })
}

import { and, desc, eq, inArray, lt } from 'drizzle-orm'

import type { Database } from '../client'
import {
  payouts,
  payoutTransfers,
  type PayoutTransferStatus,
} from '../schema/payouts'

import { formatNaira } from './format'
import { loadOrganizerBalance } from './balance'
import { newPayoutRowId, transferReference } from './references'
import { balanceCovers } from './summary'
import {
  SYSTEM_ACTOR,
  transitionPayout,
  type DbExecutor,
  type PayoutRow,
} from './transitions'

// The database half of sending a payout as a transfer. The Trigger.dev
// worker (packages/jobs/src/payouts/engine.ts) calls these around its
// Flutterwave calls; keeping the SQL here keeps every payout write in the one
// package that owns the tables, next to the state machine it goes through.

export type TransferRow = typeof payoutTransfers.$inferSelect

export async function loadPayout(
  db: DbExecutor,
  payoutId: string
): Promise<PayoutRow | null> {
  const [row] = await db
    .select()
    .from(payouts)
    .where(eq(payouts.id, payoutId))
    .limit(1)
  return row ?? null
}

/** Note why an approved payout is being held back, without moving it. */
export async function noteApprovedPayout(
  db: DbExecutor,
  payoutId: string,
  message: string,
  now: Date
): Promise<void> {
  await db
    .update(payouts)
    .set({ failureReason: message, updatedAt: now })
    .where(and(eq(payouts.id, payoutId), eq(payouts.status, 'approved')))
}

export type ClaimResult =
  | { kind: 'gone' }
  | { kind: 'held'; availableMinor: number }
  | { kind: 'claimed'; payout: PayoutRow; transfer: TransferRow }

/**
 * Claim an approved payout for sending, in one transaction under its row
 * lock: re-check the balance, write the attempt (status 'unconfirmed', with
 * its deterministic reference) BEFORE anything is sent, and move the payout
 * to 'processing'. A second claimer finds it no longer approved.
 */
export async function claimApprovedPayout(
  db: Database,
  args: { payoutId: string; testMode: boolean; now: Date }
): Promise<ClaimResult> {
  const { payoutId, now } = args
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(payouts)
      .where(eq(payouts.id, payoutId))
      .for('update')
      .limit(1)
    if (!row || row.status !== 'approved') return { kind: 'gone' as const }

    const summary = await loadOrganizerBalance(tx, row.organizerId, { now })
    if (!balanceCovers(summary, row.amountMinor, true)) {
      await tx
        .update(payouts)
        .set({
          failureReason: `Held: the organizer's balance no longer covers this (${formatNaira(summary.availableMinor)} after it). Review it.`,
          updatedAt: now,
        })
        .where(eq(payouts.id, payoutId))
      return { kind: 'held' as const, availableMinor: summary.availableMinor }
    }

    const [last] = await tx
      .select({ attempt: payoutTransfers.attempt })
      .from(payoutTransfers)
      .where(eq(payoutTransfers.payoutId, payoutId))
      .orderBy(desc(payoutTransfers.attempt))
      .limit(1)
    const attempt = (last?.attempt ?? 0) + 1
    const reference = transferReference(payoutId, attempt, {
      testMode: args.testMode,
    })
    const [transfer] = await tx
      .insert(payoutTransfers)
      .values({
        id: newPayoutRowId('pytr'),
        payoutId,
        attempt,
        reference,
        status: 'unconfirmed',
        amountMinor: row.amountMinor,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    const moved = await transitionPayout(tx, {
      payoutId,
      from: ['approved'],
      to: 'processing',
      actor: SYSTEM_ACTOR,
      set: { failureReason: '' },
      note: `Attempt ${attempt}, reference ${reference}`,
      now,
    })
    if (!moved.ok) throw new Error(`could not claim payout ${payoutId}`)
    return { kind: 'claimed' as const, payout: moved.payout, transfer: transfer! }
  })
}

/** Record a non-final note on an attempt: what the last check said. */
export async function noteTransferAttempt(
  db: DbExecutor,
  transferRowId: string,
  message: string,
  now: Date
): Promise<void> {
  await db
    .update(payoutTransfers)
    .set({ lastError: message, lastCheckedAt: now, updatedAt: now })
    .where(eq(payoutTransfers.id, transferRowId))
}

export type TransferFacts = {
  reference: string
  flwTransferId: string
  state: Exclude<PayoutTransferStatus, 'unconfirmed'>
  feeMinor: number | null
  completeMessage: string
  requiresApproval: boolean
  raw: Record<string, unknown>
}

export type ApplyResult = {
  state: PayoutTransferStatus
  // The payout, when THIS call finished it (so the caller tells the
  // organizer exactly once). Null when it was already final or still pending.
  payout: PayoutRow | null
  reference: string
  // Money went out for a payout that was no longer in flight.
  orphanedSuccess: boolean
}

/**
 * Apply what Flutterwave says about a transfer, idempotently: a final
 * attempt is never moved, a settled payout is left alone. The webhook, the
 * sweep and the sender can all deliver the same answer.
 */
export async function applyTransferFacts(
  db: Database,
  transferRowId: string,
  facts: TransferFacts,
  now: Date
): Promise<ApplyResult | null> {
  return db.transaction(async (tx) => {
    const [attempt] = await tx
      .select()
      .from(payoutTransfers)
      .where(eq(payoutTransfers.id, transferRowId))
      .for('update')
      .limit(1)
    if (!attempt) return null
    if (attempt.reference !== facts.reference) {
      throw new Error(
        `transfer reference ${facts.reference} does not match attempt ${attempt.reference}`
      )
    }
    if (attempt.status === 'successful' || attempt.status === 'failed') {
      return {
        state: attempt.status,
        payout: null,
        reference: attempt.reference,
        orphanedSuccess: false,
      }
    }

    await tx
      .update(payoutTransfers)
      .set({
        flwTransferId: facts.flwTransferId,
        status: facts.state,
        feeMinor: facts.feeMinor,
        completeMessage: facts.completeMessage,
        raw: facts.raw,
        lastError: facts.requiresApproval
          ? 'Held for approval in the Flutterwave dashboard.'
          : '',
        lastCheckedAt: now,
        updatedAt: now,
        completedAt: facts.state === 'pending' ? null : now,
      })
      .where(eq(payoutTransfers.id, attempt.id))

    if (facts.state === 'pending') {
      return {
        state: facts.state,
        payout: null,
        reference: attempt.reference,
        orphanedSuccess: false,
      }
    }

    const success = facts.state === 'successful'
    const moved = await transitionPayout(tx, {
      payoutId: attempt.payoutId,
      from: ['processing'],
      to: success ? 'paid' : 'failed',
      actor: SYSTEM_ACTOR,
      set: success
        ? { method: 'transfer', paidAt: now, failureReason: '' }
        : {
            failureReason:
              facts.completeMessage ||
              'Flutterwave reported the transfer as failed.',
          },
      note: success
        ? `Flutterwave transfer ${facts.flwTransferId} successful`
        : `Flutterwave transfer ${facts.flwTransferId} failed: ${facts.completeMessage || 'no reason given'}`,
      now,
    })
    return {
      state: facts.state,
      payout: moved.ok ? moved.payout : null,
      reference: attempt.reference,
      orphanedSuccess: success && !moved.ok,
    }
  })
}

/**
 * A definite failure — Flutterwave refused before creating anything. The
 * attempt and the payout both fail; the amount goes back on the balance.
 * Returns the payout when this call failed it.
 */
export async function failTransferAttempt(
  db: Database,
  transferRowId: string,
  message: string,
  now: Date
): Promise<PayoutRow | null> {
  return db.transaction(async (tx) => {
    const [attempt] = await tx
      .select()
      .from(payoutTransfers)
      .where(eq(payoutTransfers.id, transferRowId))
      .for('update')
      .limit(1)
    if (
      !attempt ||
      attempt.status === 'successful' ||
      attempt.status === 'failed'
    ) {
      return null
    }
    await tx
      .update(payoutTransfers)
      .set({
        status: 'failed',
        lastError: message,
        lastCheckedAt: now,
        updatedAt: now,
        completedAt: now,
      })
      .where(eq(payoutTransfers.id, attempt.id))
    const moved = await transitionPayout(tx, {
      payoutId: attempt.payoutId,
      from: ['processing'],
      to: 'failed',
      actor: SYSTEM_ACTOR,
      set: { failureReason: message },
      note: `Flutterwave refused attempt ${attempt.attempt}: ${message}`,
      now,
    })
    return moved.ok ? moved.payout : null
  })
}

export async function findAttemptByReference(
  db: DbExecutor,
  reference: string
): Promise<TransferRow | null> {
  const [row] = await db
    .select()
    .from(payoutTransfers)
    .where(eq(payoutTransfers.reference, reference))
    .limit(1)
  return row ?? null
}

/** Attempts still in flight on payouts still processing. */
export async function loadInFlightTransfers(
  db: DbExecutor,
  limit: number
): Promise<TransferRow[]> {
  const rows = await db
    .select({ transfer: payoutTransfers })
    .from(payoutTransfers)
    .innerJoin(payouts, eq(payouts.id, payoutTransfers.payoutId))
    .where(
      and(
        eq(payouts.status, 'processing'),
        inArray(payoutTransfers.status, ['unconfirmed', 'pending'])
      )
    )
    .limit(limit)
  return rows.map((r) => r.transfer)
}

/** Approved payouts nobody has picked up since `before`. */
export async function loadStaleApprovedPayoutIds(
  db: DbExecutor,
  before: Date,
  limit: number
): Promise<string[]> {
  const rows = await db
    .select({ id: payouts.id })
    .from(payouts)
    .where(and(eq(payouts.status, 'approved'), lt(payouts.updatedAt, before)))
    .limit(limit)
  return rows.map((r) => r.id)
}

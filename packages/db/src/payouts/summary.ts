import type { PayoutStatus } from '../schema/payouts'

import { OPEN_PAYOUT_STATUSES } from './constants'

// The balance arithmetic, with no database in it. balance.ts loads the
// numbers; this decides what they add up to, so every rule is unit-tested
// without a database and every surface computes the same answer.
//
// Paid earnings are withdrawable straight away: there is no hold until an
// event ends (see constants.ts).

/** One event's earnings for its organizer: the share of its paid orders. */
export type EventEarnings = {
  eventId: string
  title: string
  // The event's last day (end date, else event date) as YYYY-MM-DD, or null.
  lastDay: string | null
  paidOrders: number
  earnedMinor: number
}

export type EventBalanceLine = EventEarnings

/** A payout total by status. */
export type PayoutAmount = { status: PayoutStatus; amountMinor: number }

export type BalanceSummary = {
  // Everything earned from paid orders.
  earnedMinor: number
  // Admin adjustments, signed.
  adjustmentsMinor: number
  // Requested, approved or being sent.
  inProgressMinor: number
  // Already paid out.
  paidOutMinor: number
  // earned + adjustments − in progress − paid out. Negative when a refund or
  // correction landed after money had already gone.
  availableMinor: number
  // What can be asked for right now: available, floored to whole naira (the
  // unit transfers are made in) and never below zero.
  withdrawableMinor: number
  events: EventBalanceLine[]
}

/** Kobo floored to whole naira. */
export function wholeNaira(minor: number): number {
  return Math.floor(minor / 100) * 100
}

const OPEN = new Set<PayoutStatus>(OPEN_PAYOUT_STATUSES)

export function summariseBalance(input: {
  events: EventEarnings[]
  payouts: PayoutAmount[]
  adjustmentsMinor: number
}): BalanceSummary {
  const events: EventBalanceLine[] = input.events.map((e) => ({ ...e }))

  let earnedMinor = 0
  for (const e of events) earnedMinor += e.earnedMinor

  let inProgressMinor = 0
  let paidOutMinor = 0
  for (const p of input.payouts) {
    if (OPEN.has(p.status)) inProgressMinor += p.amountMinor
    else if (p.status === 'paid') paidOutMinor += p.amountMinor
    // failed / rejected / cancelled release the money: they count for nothing.
  }

  const availableMinor =
    earnedMinor + input.adjustmentsMinor - inProgressMinor - paidOutMinor

  // Biggest first, then by title: the order an organizer scans in.
  events.sort(
    (a, b) => b.earnedMinor - a.earnedMinor || a.title.localeCompare(b.title)
  )

  return {
    earnedMinor,
    adjustmentsMinor: input.adjustmentsMinor,
    inProgressMinor,
    paidOutMinor,
    availableMinor,
    withdrawableMinor: Math.max(0, wholeNaira(availableMinor)),
    events,
  }
}

/**
 * Whether a balance can carry one more payout of `amountMinor` on top of
 * what it already carries.
 *
 * `alreadyCounted` says whether the payout in question is one of the amounts
 * already inside `summary` (a pending request being approved is; a failed
 * one being retried is not, because failure released it). The rule is that
 * the balance must not go below zero with the payout in it.
 */
export function balanceCovers(
  summary: Pick<BalanceSummary, 'availableMinor'>,
  amountMinor: number,
  alreadyCounted: boolean
): boolean {
  const after = alreadyCounted
    ? summary.availableMinor
    : summary.availableMinor - amountMinor
  return after >= 0
}

import type { PayoutStatus } from '../schema/payouts'

import { OPEN_PAYOUT_STATUSES, PAYOUT_HOLD_DAYS } from './constants'
import { isReleased, releaseDateFor } from './release'

// The balance arithmetic, with no database in it. balance.ts loads the
// numbers; this decides what they add up to, so every rule is unit-tested
// without a database and every surface computes the same answer.

/** One event's earnings for its organizer: the share of its paid orders. */
export type EventEarnings = {
  eventId: string
  title: string
  // The event's last day (end date, else event date) as YYYY-MM-DD, or null.
  lastDay: string | null
  paidOrders: number
  earnedMinor: number
}

export type EventBalanceLine = EventEarnings & {
  // The first day this event's money can be withdrawn; null = not dated.
  releaseDate: string | null
  released: boolean
}

/** A payout total by status. */
export type PayoutAmount = { status: PayoutStatus; amountMinor: number }

export type BalanceSummary = {
  // Everything earned, released or not.
  earnedMinor: number
  // Earned and not yet released (the event has not ended, plus the hold).
  heldMinor: number
  // Earned and released.
  releasedMinor: number
  // Admin adjustments, signed.
  adjustmentsMinor: number
  // Requested, approved or being sent.
  inProgressMinor: number
  // Already paid out.
  paidOutMinor: number
  // released + adjustments − in progress − paid out. Negative when a refund
  // or correction landed after money had already gone.
  availableMinor: number
  // What can be asked for right now: available, floored to whole naira (the
  // unit transfers are made in) and never below zero.
  withdrawableMinor: number
  earlyRelease: boolean
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
  earlyRelease: boolean
  // Lagos date, YYYY-MM-DD.
  today: string
  holdDays?: number
}): BalanceSummary {
  const holdDays = input.holdDays ?? PAYOUT_HOLD_DAYS

  const events: EventBalanceLine[] = input.events.map((e) => {
    const releaseDate = releaseDateFor(e.lastDay, holdDays)
    return {
      ...e,
      releaseDate,
      released: input.earlyRelease || isReleased(releaseDate, input.today),
    }
  })

  let earnedMinor = 0
  let releasedMinor = 0
  for (const e of events) {
    earnedMinor += e.earnedMinor
    if (e.released) releasedMinor += e.earnedMinor
  }

  let inProgressMinor = 0
  let paidOutMinor = 0
  for (const p of input.payouts) {
    if (OPEN.has(p.status)) inProgressMinor += p.amountMinor
    else if (p.status === 'paid') paidOutMinor += p.amountMinor
    // failed / rejected / cancelled release the money: they count for nothing.
  }

  const availableMinor =
    releasedMinor + input.adjustmentsMinor - inProgressMinor - paidOutMinor

  // Biggest first, then soonest to release: the order an organizer scans in.
  events.sort(
    (a, b) =>
      b.earnedMinor - a.earnedMinor ||
      (a.releaseDate ?? '9999').localeCompare(b.releaseDate ?? '9999')
  )

  return {
    earnedMinor,
    heldMinor: earnedMinor - releasedMinor,
    releasedMinor,
    adjustmentsMinor: input.adjustmentsMinor,
    inProgressMinor,
    paidOutMinor,
    availableMinor,
    withdrawableMinor: Math.max(0, wholeNaira(availableMinor)),
    earlyRelease: input.earlyRelease,
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

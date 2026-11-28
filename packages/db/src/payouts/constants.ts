import type { PaymentDiscrepancyKind } from '../schema/payments'
import type { PayoutStatus } from '../schema/payouts'

// The payout rules, in one place. Every surface that shows or enforces a rule
// (the organizer's page, the admin console, the request mutation, the
// transfer job) reads it from here, so they cannot drift apart.

/** The only currency payouts are made in. */
export const PAYOUT_CURRENCY = 'NGN'

/**
 * Calendar dates — an event's last day, "today" — are Nigerian dates. An event
 * ending on the 20th releases on the 21st in Lagos, whatever the server clock
 * says.
 */
export const PAYOUT_TIMEZONE = 'Africa/Lagos'

// Earnings are withdrawable as soon as an order is paid: there is no hold
// until the event ends (product decision, 2026-11-28). Admin approval of
// every request is the control. A cancelled event's refunds can therefore
// exceed what is left on the platform; the balance then goes negative and
// blocks further withdrawals until it is made up.

/**
 * The smallest withdrawal: ₦1, in kobo. Organizers may withdraw any amount
 * (product decision, 2026-11-28); this only keeps a request above zero, in
 * the whole naira transfers are made in.
 */
export const MIN_PAYOUT_MINOR = 100

/**
 * A bank account added (or changed to) less than this long ago cannot receive
 * a withdrawal yet. If someone takes over an organizer's login and swaps the
 * account, the real organizer has a day to see the email and say so before
 * any money can follow.
 */
export const NEW_ACCOUNT_COOLDOWN_MS = 24 * 60 * 60 * 1000

/** Requests still in motion: at most one per organizer (a partial unique index). */
export const OPEN_PAYOUT_STATUSES = [
  'pending_review',
  'approved',
  'processing',
] as const satisfies readonly PayoutStatus[]

/**
 * Statuses whose amount is off the organizer's balance: everything open, plus
 * paid. Failed, rejected and cancelled release the money back.
 */
export const COMMITTED_PAYOUT_STATUSES = [
  ...OPEN_PAYOUT_STATUSES,
  'paid',
] as const satisfies readonly PayoutStatus[]

/**
 * Refund records that mean an order's whole charge goes back to the buyer, so
 * the organizer has not earned it: a paid application the organizer rejected,
 * and votes bought for a contest that had closed. Open OR resolved — once the
 * refund is issued the money has gone back either way.
 *
 * The other kinds do not touch the organizer's share: an overpayment's excess
 * was never part of the order total, and a rejected, duplicate or undelivered
 * charge never made the order 'paid' in the first place.
 */
export const OWED_BACK_DISCREPANCY_KINDS = [
  'registration_rejected',
  'votes_unusable',
] as const satisfies readonly PaymentDiscrepancyKind[]

/**
 * How far payouts are switched on (env PAYOUTS_MODE):
 *   off     balances are visible, nobody can request a withdrawal
 *   manual  organizers request, admins approve and pay by hand in Flutterwave
 *   live    approval sends the transfer automatically (Trigger.dev worker)
 */
export const PAYOUT_MODES = ['off', 'manual', 'live'] as const
export type PayoutMode = (typeof PAYOUT_MODES)[number]

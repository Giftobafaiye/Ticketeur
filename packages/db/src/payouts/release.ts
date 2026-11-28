import { PAYOUT_HOLD_DAYS, PAYOUT_TIMEZONE } from './constants'

// When an event's earnings become withdrawable. Pure date arithmetic on
// YYYY-MM-DD strings — the same shape `events.event_date` and
// `events.end_date` are stored in — so there is no timezone to get wrong
// except the one place "today" is decided.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** A real calendar date in YYYY-MM-DD form ("2026-02-30" is not). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false
  const ms = Date.parse(`${value}T00:00:00Z`)
  return (
    Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value
  )
}

const LAGOS_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: PAYOUT_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Today's date in Lagos, as YYYY-MM-DD. */
export function lagosDate(now: Date): string {
  return LAGOS_DATE.format(now)
}

/** `ymd` plus `days` calendar days. */
export function addDays(ymd: string, days: number): string {
  const ms = Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * The first day an event's earnings can be withdrawn: its last day plus the
 * hold. NULL when the event has no usable date (a "TBD" event) — such money
 * stays on hold until the event is dated, or an admin releases it early.
 */
export function releaseDateFor(
  lastDay: string | null,
  holdDays: number = PAYOUT_HOLD_DAYS
): string | null {
  if (!isIsoDate(lastDay)) return null
  return addDays(lastDay, holdDays)
}

/** Whether a release date has arrived. A missing date never has. */
export function isReleased(releaseDate: string | null, today: string): boolean {
  return releaseDate !== null && releaseDate <= today
}

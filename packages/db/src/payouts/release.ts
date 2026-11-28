import { PAYOUT_TIMEZONE } from './constants'

// Date helpers on YYYY-MM-DD strings, the shape `events.event_date` and
// `events.end_date` are stored in, so there is no timezone to get wrong
// except the one place "today" is decided. (Earnings used to be held until
// an event ended; they no longer are, see constants.ts.)

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

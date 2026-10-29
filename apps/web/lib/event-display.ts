import { format } from 'date-fns'

import { formatEventDateRange, toDate } from './date'

export function initialsFromTitle(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '??'
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return (words[0]![0]! + words[1]![0]!).toUpperCase()
}

// Range-aware: pass an end ISO for multi-day events, or null/undefined for single.
// A null/empty start (TBD / postponed event) renders as "TBD".
export function formatEventDate(
  start: string | null | undefined,
  end?: string | null
): string {
  return formatEventDateRange(start, end ?? null)
}

// Weekday for a date, or empty string when there's no date (TBD) — callers
// that compose "weekday, date" should omit the comma when this is empty.
export function formatWeekday(iso: string | null | undefined): string {
  const d = toDate(iso)
  if (!d) return ''
  return format(d, 'EEEE')
}

export function eventCode(id: string): string {
  // Stable display code; truncate UUID for readability
  return `EVT-${id.replace(/^evt_/, '').slice(0, 8).toUpperCase()}`
}

// The public page an event is served at. The slug is generated once and never
// regenerated, so a link already shared keeps working through a rename.
export function publicEventPath(slug: string): string {
  return `/events/${slug}`
}

export function formatNaira(minor: number): string {
  return `₦${(minor / 100).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`
}

// True while today falls within an event's dates (a single-day event: its
// date). Compared as local YYYY-MM-DD strings, the format events are stored in.
export function isHappeningToday(
  start: string | null | undefined,
  end?: string | null
): boolean {
  if (!start) return false
  const today = format(new Date(), 'yyyy-MM-dd')
  return start <= today && (end ?? start) >= today
}

// The status a buyer sees on an event card, most urgent first: finished, sold
// out, on right now, or still to come.
export type EventCardStatus = 'past' | 'sold-out' | 'live' | 'upcoming'

export function eventCardStatus(ev: {
  eventDate: string | null
  endDate: string | null
  soldOut?: boolean
  ended?: boolean
}): EventCardStatus {
  if (ev.ended) return 'past'
  if (ev.soldOut) return 'sold-out'
  if (isHappeningToday(ev.eventDate, ev.endDate)) return 'live'
  return 'upcoming'
}

export const EVENT_CARD_STATUS_LABEL: Record<EventCardStatus, string> = {
  past: 'Ended',
  'sold-out': 'Sold out',
  live: 'Happening now',
  upcoming: 'Upcoming',
}

// The kinds of event an organizer can file theirs under, and that buyers
// filter the marketplace by. Pure data with no imports, so the client bundle
// (the create-event form, the marketplace filters) can import it alongside the
// server that validates against it.
export const EVENT_CATEGORIES = [
  'Music',
  'Fashion',
  'Art',
  'Tech',
  'Food & Drink',
  'Sports',
  'Comedy',
  'Business',
  'Festival',
  'Other',
] as const

export type EventCategory = (typeof EVENT_CATEGORIES)[number]

export function isEventCategory(value: unknown): value is EventCategory {
  return (
    typeof value === 'string' &&
    (EVENT_CATEGORIES as readonly string[]).includes(value)
  )
}

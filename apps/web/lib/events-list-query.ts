import type { EventCategory } from '@ticketur/api/lib/event-categories'

// The marketplace's price slider works in whole naira; the API takes kobo.
export const PRICE_MIN_DEFAULT = 0
export const PRICE_MAX_DEFAULT = 100_000
export const PRICE_STEP = 1_000

export const EVENTS_GRID_PAGE_SIZE = 6

export type EventsListSort =
  'soonest' | 'newest' | 'price-asc' | 'price-desc' | 'popular'

export type EventsListState = {
  tab: 'upcoming' | 'past'
  q: string
  sort: EventsListSort
  categories: EventCategory[]
  date: string
  priceMin: number
  priceMax: number
  location: string
  page: number
}

// The public.events.list input for a marketplace state. Shared by the server
// prefetch (app/(app)/events/page.tsx) and the grid, so the two build the same
// query key and the grid hydrates instead of refetching.
export function eventsListInput(state: EventsListState) {
  return {
    tab: state.tab,
    q: state.q.trim(),
    sort: state.sort,
    categories: state.categories,
    location: state.location.trim(),
    date: state.date,
    // The slider's ends mean "no bound": its top is "₦100,000+", not a cap.
    priceMinMinor:
      state.priceMin > PRICE_MIN_DEFAULT ? state.priceMin * 100 : null,
    priceMaxMinor:
      state.priceMax < PRICE_MAX_DEFAULT ? state.priceMax * 100 : null,
    page: state.page,
    pageSize: EVENTS_GRID_PAGE_SIZE,
  }
}

export const DEFAULT_EVENTS_LIST_STATE: EventsListState = {
  tab: 'upcoming',
  q: '',
  sort: 'soonest',
  categories: [],
  date: '',
  priceMin: PRICE_MIN_DEFAULT,
  priceMax: PRICE_MAX_DEFAULT,
  location: '',
  page: 1,
}

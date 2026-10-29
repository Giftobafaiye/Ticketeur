'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  FilterIcon,
} from '@hugeicons/core-free-icons'

import { cn } from '@ticketur/ui/lib/utils'
import { SmallEventCard } from '@/components/cards/small-event-card'
import {
  EventFilters,
  type FiltersValue,
  PRICE_MAX_DEFAULT,
  PRICE_MIN_DEFAULT,
} from '@/components/sections/events/event-filters'
import { EventsToolbar } from '@/components/sections/events/events-toolbar'
import { MobileFilterDrawer } from '@/components/sections/events/mobile-filter-drawer'
import { EVENT_CATEGORIES } from '@ticketur/api/lib/event-categories'

import { useTRPC } from '@/lib/trpc'
import { eventCardStatus, formatNaira } from '@/lib/event-display'
import { EVENTS_GRID_PAGE_SIZE, eventsListInput } from '@/lib/events-list-query'

const PAGE_SIZE = EVENTS_GRID_PAGE_SIZE
const EVENT_PLACEHOLDER = '/hero-bg.png'

export function EventsGridSection() {
  const trpc = useTRPC()
  const [state, setState] = useQueryStates(
    {
      tab: parseAsStringLiteral(['upcoming', 'past']).withDefault('upcoming'),
      q: parseAsString.withDefault(''),
      sort: parseAsStringLiteral([
        'soonest',
        'newest',
        'price-asc',
        'price-desc',
        'popular',
      ]).withDefault('soonest'),
      categories: parseAsArrayOf(
        parseAsStringLiteral(EVENT_CATEGORIES)
      ).withDefault([]),
      date: parseAsString.withDefault(''),
      priceMin: parseAsInteger.withDefault(PRICE_MIN_DEFAULT),
      priceMax: parseAsInteger.withDefault(PRICE_MAX_DEFAULT),
      location: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
    },
    { shallow: true }
  )

  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  const filterValues: FiltersValue = {
    categories: state.categories,
    date: state.date,
    priceMin: state.priceMin,
    priceMax: state.priceMax,
    location: state.location,
  }

  const patchFilters = (patch: Partial<FiltersValue>) => {
    setState({ ...patch, page: 1 })
  }

  const clearFilters = () => {
    setState({
      categories: null,
      date: null,
      priceMin: null,
      priceMax: null,
      location: null,
      page: 1,
    })
  }

  const activeFilterCount =
    (state.categories.length > 0 ? 1 : 0) +
    (state.date ? 1 : 0) +
    (state.location ? 1 : 0) +
    (state.priceMin > PRICE_MIN_DEFAULT || state.priceMax < PRICE_MAX_DEFAULT
      ? 1
      : 0)

  // Every filter, the search and the sort are applied by the server, so the
  // count and the pages are of what actually matches.
  const listQuery = useQuery({
    ...trpc.public.events.list.queryOptions(eventsListInput(state)),
    placeholderData: (prev) => prev,
  })

  const total = listQuery.data?.total ?? 0
  const rows = listQuery.data?.rows ?? []
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(state.page, totalPages)
  const isPast = state.tab === 'past'
  const pageItems = rows.map((ev) => ({
    id: ev.id,
    title: ev.title,
    category: ev.category ?? '',
    status: eventCardStatus({ ...ev, ended: isPast }),
    // A finished event's ticket price is no longer actionable, so the slot
    // carries the turnout instead — the reason to show past events at all.
    price: isPast
      ? ev.attendeeCount > 0
        ? `${ev.attendeeCount.toLocaleString()} ${ev.attendeeCount === 1 ? 'attendee' : 'attendees'}`
        : 'Hosted'
      : ev.minPrice > 0
        ? formatNaira(ev.minPrice)
        : 'Free',
    date: ev.eventDate,
    endDate: ev.endDate,
    location: ev.location,
    imageUrl: ev.bannerUrl ?? EVENT_PLACEHOLDER,
    href: `/events/${ev.slug}`,
  }))

  return (
    <section aria-label="All events" className="relative w-full px-5 md:px-10">
      <div className="mx-auto flex max-w-360 gap-10 pb-16 md:pb-20">
        <aside
          aria-label="Filters"
          className="hidden w-[320px] shrink-0 lg:block"
        >
          <div className="sticky top-24">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="font-heading text-foreground text-lg font-semibold">
                Filters
              </h2>
              <AnimatePresence initial={false}>
                {activeFilterCount > 0 && (
                  <motion.button
                    key="clear"
                    type="button"
                    onClick={clearFilters}
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 6 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    whileTap={{ scale: 0.96 }}
                    className="text-primary hover:text-primary-hover inline-flex items-center gap-1 text-sm font-medium transition-colors"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-3.5"
                      aria-hidden
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                    Clear all
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            <EventFilters values={filterValues} onChange={patchFilters} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <EventsToolbar
            tab={state.tab}
            onTabChange={(t) => setState({ tab: t, page: 1 })}
            query={state.q}
            onQueryChange={(q) => setState({ q: q || null, page: 1 })}
            sort={state.sort}
            onSortChange={(s) => setState({ sort: s, page: 1 })}
          />

          {listQuery.isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-muted h-72 animate-pulse rounded-2xl"
                />
              ))}
            </div>
          ) : pageItems.length === 0 ? (
            <EmptyState tab={state.tab} />
          ) : (
            <motion.div
              layout
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {pageItems.map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: i * 0.05,
                    duration: 0.4,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <SmallEventCard {...event} />
                </motion.div>
              ))}
            </motion.div>
          )}

          {totalPages > 1 && (
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              onChange={(p) => setState({ page: p })}
            />
          )}
        </div>
      </div>

      <MobileFloatingFilterButton
        count={activeFilterCount}
        onClick={() => setMobileFilterOpen(true)}
      />

      <MobileFilterDrawer
        open={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        values={filterValues}
        onApply={(next) =>
          setState({
            categories: next.categories.length > 0 ? next.categories : null,
            date: next.date || null,
            priceMin:
              next.priceMin === PRICE_MIN_DEFAULT ? null : next.priceMin,
            priceMax:
              next.priceMax === PRICE_MAX_DEFAULT ? null : next.priceMax,
            location: next.location || null,
            page: 1,
          })
        }
      />
    </section>
  )
}

function EmptyState({ tab }: { tab: 'upcoming' | 'past' }) {
  return (
    <div className="border-border bg-muted/20 flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed p-10 text-center">
      <p className="font-heading text-foreground text-lg font-semibold">
        {tab === 'past' ? 'No past events yet' : 'No events match your filters'}
      </p>
      <p className="text-muted-foreground mt-1 text-sm">
        {tab === 'past'
          ? 'Events show up here once they have finished.'
          : 'Try clearing some filters or searching for something else.'}
      </p>
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (p: number) => void
}) {
  const pages = getPageList(page, totalPages)
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-2 pt-4"
    >
      <PageButton
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        <HugeiconsIcon
          icon={ArrowLeft01Icon}
          className="size-4"
          strokeWidth={2}
        />
      </PageButton>
      {pages.map((p, i) =>
        p === '…' ? (
          <span
            key={`dots-${i}`}
            className="text-muted-foreground px-1 text-sm"
          >
            …
          </span>
        ) : (
          <PageButton
            key={p}
            active={p === page}
            onClick={() => onChange(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </PageButton>
        )
      )}
      <PageButton
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          className="size-4"
          strokeWidth={2}
        />
      </PageButton>
    </nav>
  )
}

function PageButton({
  active,
  disabled,
  onClick,
  children,
  ...props
}: {
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex size-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-foreground hover:border-primary hover:text-primary',
        disabled && 'pointer-events-none opacity-40'
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function getPageList(page: number, total: number): (number | '…')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages: (number | '…')[] = [1]
  if (page > 3) pages.push('…')
  const start = Math.max(2, page - 1)
  const end = Math.min(total - 1, page + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (page < total - 2) pages.push('…')
  pages.push(total)
  return pages
}

function MobileFloatingFilterButton({
  count,
  onClick,
}: {
  count: number
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.3, ease: 'easeOut' }}
      whileTap={{ scale: 0.95 }}
      className="bg-primary text-primary-foreground shadow-primary/30 hover:bg-primary-hover fixed right-5 bottom-6 z-40 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium shadow-xl transition-colors md:right-8 md:bottom-8 lg:hidden"
    >
      <HugeiconsIcon icon={FilterIcon} className="size-4" strokeWidth={2} />
      Filter
      {count > 0 && (
        <span className="text-primary ml-1 inline-flex size-5 items-center justify-center rounded-full bg-white text-[11px] font-semibold">
          {count}
        </span>
      )}
    </motion.button>
  )
}

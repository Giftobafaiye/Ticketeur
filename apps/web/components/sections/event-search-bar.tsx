'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseAsString, useQueryStates } from 'nuqs'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Calendar03Icon,
  Location01Icon,
  Search01Icon,
} from '@hugeicons/core-free-icons'

import { cn } from '@ticketur/ui/lib/utils'
import { Calendar } from '@ticketur/ui/components/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@ticketur/ui/components/popover'
import {
  formatEventDateRange,
  formatShortDate,
  toDate,
  toIsoDate,
} from '@/lib/date'
import { useTRPC } from '@/lib/trpc'

const SEARCH_KEYS = {
  q: parseAsString.withDefault(''),
  location: parseAsString.withDefault(''),
  date: parseAsString.withDefault(''),
}

// The value after the user has stopped typing for `ms`, so the type-ahead
// asks the server once per pause rather than once per keystroke.
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export function EventSearchBar({ className }: { className?: string }) {
  const router = useRouter()
  const trpc = useTRPC()
  const [state, setState] = useQueryStates(SEARCH_KEYS, {
    shallow: true,
    throttleMs: 200,
  })
  // Which dropdown is open, if any. Closed on blur after a beat so a click on
  // an option lands before the list disappears.
  const [open, setOpen] = useState<'q' | 'location' | null>(null)
  const closeSoon = () => setTimeout(() => setOpen(null), 150)

  const q = useDebounced(state.q.trim(), 200)
  const location = useDebounced(state.location.trim(), 200)
  const suggest = useQuery({
    ...trpc.public.events.suggest.queryOptions({ q, location }),
    enabled: open !== null,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
  const eventMatches = q ? (suggest.data?.events ?? []) : []
  const places = suggest.data?.locations ?? []

  const hasFilters = Boolean(state.q || state.location || state.date)

  const clearFilters = () => {
    setState({ q: null, location: null, date: null })
  }

  const selectedDate = useMemo(
    () => toDate(state.date) ?? undefined,
    [state.date]
  )

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setOpen(null)
    // A search that names one event exactly goes straight to it.
    const typed = state.q.trim().toLowerCase()
    const exact = typed
      ? eventMatches.filter((ev) => ev.title.toLowerCase() === typed)
      : []
    if (exact.length === 1 && exact[0]) {
      router.push(`/events/${exact[0].slug}`)
      return
    }
    const params = new URLSearchParams()
    if (state.q.trim()) params.set('q', state.q.trim())
    if (state.location.trim()) params.set('location', state.location.trim())
    if (state.date) params.set('date', state.date)
    const qs = params.toString()
    router.push(qs ? `/events?${qs}` : '/events')
  }

  return (
    <div
      className={cn(
        'flex w-full max-w-[801px] flex-col items-center gap-3',
        className
      )}
    >
      <motion.form
        onSubmit={onSubmit}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.35, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="w-full rounded-[10px] border border-[#e1e3ee] bg-white p-4 shadow-[0_20px_60px_-15px_rgba(16,24,40,0.25)] md:rounded-[20px] md:p-[10px] md:pl-4"
      >
        <div className="flex flex-col gap-2.5 md:flex-row md:items-stretch md:gap-0">
          <div className="flex flex-1 flex-col gap-2.5 md:flex-row md:items-center md:gap-0">
            <Field icon={Search01Icon} position="first">
              <input
                type="text"
                name="q"
                value={state.q}
                onChange={(e) => {
                  setState({ q: e.target.value || null })
                  setOpen('q')
                }}
                onFocus={() => setOpen('q')}
                onBlur={closeSoon}
                placeholder="Event name or artist"
                autoComplete="off"
                role="combobox"
                aria-expanded={open === 'q' && eventMatches.length > 0}
                aria-controls="event-search-suggestions"
                className="w-full min-w-0 bg-transparent text-sm text-[#282828] outline-none placeholder:text-[#c6c6c6] md:text-base"
              />
              {open === 'q' && eventMatches.length > 0 ? (
                <Suggestions id="event-search-suggestions" label="Events">
                  {eventMatches.map((ev) => (
                    <SuggestionButton
                      key={ev.id}
                      onPick={() => {
                        setOpen(null)
                        router.push(`/events/${ev.slug}`)
                      }}
                    >
                      <span className="block truncate font-medium text-[#282828]">
                        {ev.title}
                      </span>
                      <span className="block truncate text-xs text-[#8a8a8a]">
                        {formatEventDateRange(ev.eventDate, ev.endDate)} ·{' '}
                        {ev.location}
                      </span>
                    </SuggestionButton>
                  ))}
                </Suggestions>
              ) : null}
            </Field>

            <Field icon={Location01Icon} position="middle">
              <input
                type="text"
                name="location"
                value={state.location}
                onChange={(e) => {
                  setState({ location: e.target.value || null })
                  setOpen('location')
                }}
                onFocus={() => setOpen('location')}
                onBlur={closeSoon}
                placeholder="Location"
                autoComplete="off"
                role="combobox"
                aria-expanded={open === 'location' && places.length > 0}
                aria-controls="location-search-suggestions"
                className="w-full min-w-0 bg-transparent text-sm text-[#282828] outline-none placeholder:text-[#c6c6c6] md:text-base"
              />
              {open === 'location' && places.length > 0 ? (
                <Suggestions id="location-search-suggestions" label="Locations">
                  {places.map((place) => (
                    <SuggestionButton
                      key={place}
                      onPick={() => {
                        setState({ location: place })
                        setOpen(null)
                      }}
                    >
                      <span className="block truncate text-[#282828]">
                        {place}
                      </span>
                    </SuggestionButton>
                  ))}
                </Suggestions>
              ) : null}
            </Field>

            <Field icon={Calendar03Icon} position="last">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'w-full min-w-0 cursor-pointer bg-transparent text-left text-sm outline-none md:text-base',
                      state.date ? 'text-[#282828]' : 'text-[#c6c6c6]'
                    )}
                  >
                    {state.date ? formatShortDate(state.date) : 'Date'}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  sideOffset={10}
                  className="w-auto p-0"
                >
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) =>
                      setState({ date: d ? toIsoDate(d) : null })
                    }
                    captionLayout="dropdown"
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
            </Field>
          </div>

          <motion.button
            type="submit"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            className="bg-primary text-primary-foreground hover:bg-primary-hover mt-2 flex h-13 items-center justify-center gap-2.5 rounded-[10px] px-6 text-base font-medium transition-colors md:mt-0 md:ml-4 md:size-[54px] md:p-0"
          >
            <HugeiconsIcon
              icon={Search01Icon}
              className="size-5 md:size-[26px]"
              strokeWidth={2}
            />
            <span className="md:hidden">Search</span>
          </motion.button>
        </div>
      </motion.form>

      <AnimatePresence initial={false}>
        {hasFilters && (
          <motion.button
            key="clear-filters"
            type="button"
            onClick={clearFilters}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="group inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/25"
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
            Clear filters
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

function Field({
  icon,
  position,
  children,
}: {
  icon: Parameters<typeof HugeiconsIcon>[0]['icon']
  position: 'first' | 'middle' | 'last'
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'relative flex flex-1 items-center gap-2 border-b border-[#ededed] py-2 md:gap-4 md:border-b-0 md:px-4 md:py-4',
        position === 'last' && 'border-b-0',
        position !== 'first' && 'md:border-l md:border-[#c6c6c6]'
      )}
    >
      <HugeiconsIcon
        icon={icon}
        className="size-4 shrink-0 text-[#ababab] md:size-5"
        strokeWidth={1.6}
      />
      {children}
    </div>
  )
}

function Suggestions({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      id={id}
      role="listbox"
      aria-label={label}
      className="absolute top-full right-0 left-0 z-30 mt-2 max-h-72 overflow-y-auto rounded-xl border border-[#e1e3ee] bg-white p-1.5 text-left shadow-[0_20px_60px_-15px_rgba(16,24,40,0.25)]"
    >
      {children}
    </div>
  )
}

function SuggestionButton({
  onPick,
  children,
}: {
  onPick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={false}
      // mousedown, not click: it fires before the input's blur closes the list.
      onMouseDown={(e) => {
        e.preventDefault()
        onPick()
      }}
      className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f4f1ff] focus:bg-[#f4f1ff] focus:outline-none"
    >
      {children}
    </button>
  )
}

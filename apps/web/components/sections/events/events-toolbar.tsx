'use client'

import { motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Search01Icon } from '@hugeicons/core-free-icons'

import { cn } from '@ticketur/ui/lib/utils'
import type { EventsListSort } from '@/lib/events-list-query'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ticketur/ui/components/select'

export type EventTab = 'upcoming' | 'past'
export type EventSort = EventsListSort

const TABS: { key: EventTab; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming Events' },
  { key: 'past', label: 'Past Events' },
]

export function EventsToolbar({
  tab,
  onTabChange,
  query,
  onQueryChange,
  sort,
  onSortChange,
}: {
  tab: EventTab
  onTabChange: (t: EventTab) => void
  query: string
  onQueryChange: (q: string) => void
  sort: EventSort
  onSortChange: (s: EventSort) => void
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
      <nav aria-label="Event status" className="flex items-center gap-1">
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onTabChange(t.key)}
              className={cn(
                'relative px-3 py-2 text-sm font-medium transition-colors outline-none',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
              {active && (
                <motion.span
                  layoutId="events-tab-underline"
                  className="bg-primary absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
            </button>
          )
        })}
      </nav>

      <div className="flex items-center gap-3">
        <label className="border-border bg-background focus-within:border-primary flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 md:w-[260px] md:flex-none">
          <HugeiconsIcon
            icon={Search01Icon}
            className="text-muted-foreground size-4 shrink-0"
            strokeWidth={1.6}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search"
            className="text-foreground placeholder:text-muted-foreground w-full min-w-0 bg-transparent text-sm outline-none"
          />
        </label>

        <Select
          value={sort}
          // Past events are always shown most recent first.
          disabled={tab === 'past'}
          onValueChange={(v) => onSortChange(v as EventSort)}
        >
          <SelectTrigger className="h-10 w-[140px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="soonest">Soonest first</SelectItem>
            <SelectItem value="newest">Newly added</SelectItem>
            <SelectItem value="price-asc">Price: low to high</SelectItem>
            <SelectItem value="price-desc">Price: high to low</SelectItem>
            <SelectItem value="popular">Most popular</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

'use client'

import { AnimatePresence, motion } from 'motion/react'
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { HugeiconsIcon } from '@hugeicons/react'
import { Calendar03Icon } from '@hugeicons/core-free-icons'

import { cn } from '@ticketur/ui/lib/utils'

import {
  ANALYTICS_PERIOD_LABELS,
  ANALYTICS_PERIODS,
  ANALYTICS_TAB_LABELS,
  ANALYTICS_TABS,
  type AnalyticsPeriod,
} from './shared'
import { AnalyticsOverallTab } from './overall-tab'
import { AnalyticsBookingsTab } from './bookings-tab'
import { AnalyticsRatingsTab } from './ratings-tab'
import { AnalyticsReportsTab } from './reports-tab'

export function VendorAnalyticsContent({
  vendorName = 'Vendor',
}: {
  vendorName?: string
}) {
  const [{ tab, period, date }, setState] = useQueryStates(
    {
      tab: parseAsStringLiteral(ANALYTICS_TABS).withDefault('overall'),
      period: parseAsStringLiteral(ANALYTICS_PERIODS).withDefault('7d'),
      date: parseAsString.withDefault(''),
    },
    // Keep the analytics view out of the browser history stack — flipping tabs
    // or ranges shouldn't trap the back button.
    { history: 'replace' }
  )

  const range = { period, date: date === '' ? null : date }

  return (
    <div className="flex min-h-0 flex-1 scrollbar-none flex-col gap-6 overflow-y-auto md:gap-8 [&::-webkit-scrollbar]:hidden">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight md:text-[28px]">
            Analytics
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Track your business performance on Ticketeur.
          </p>
        </div>

        <PeriodSelector
          period={period}
          date={date}
          onPeriod={(p) => setState({ period: p, date: '' })}
          onDate={(d) => setState({ date: d })}
        />
      </header>

      <div
        role="tablist"
        aria-label="Analytics views"
        className="border-border [scrollbar-width:none] -mt-2 overflow-x-auto border-b [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex items-center gap-6 md:gap-8">
          {ANALYTICS_TABS.map((t) => {
            const active = tab === t
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setState({ tab: t })}
                className={cn(
                  'relative -mb-px shrink-0 px-1 pb-3 text-sm font-semibold whitespace-nowrap transition-colors outline-none md:text-base',
                  active
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {ANALYTICS_TAB_LABELS[t]}
                {active && (
                  <motion.span
                    layoutId="vendor-analytics-tab-underline"
                    className="bg-primary absolute inset-x-0 -bottom-px h-[3px] rounded-full"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          {tab === 'overall' && <AnalyticsOverallTab range={range} />}
          {tab === 'bookings' && <AnalyticsBookingsTab range={range} />}
          {tab === 'ratings' && <AnalyticsRatingsTab />}
          {tab === 'reports' && (
            <AnalyticsReportsTab range={range} vendorName={vendorName} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function PeriodSelector({
  period,
  date,
  onPeriod,
  onDate,
}: {
  period: AnalyticsPeriod
  date: string
  onPeriod: (p: AnalyticsPeriod) => void
  onDate: (d: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 md:gap-2.5">
      <div className="border-border bg-background inline-flex items-center rounded-xl border p-1">
        {ANALYTICS_PERIODS.map((p) => {
          const active = date === '' && p === period
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPeriod(p)}
              aria-pressed={active}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors md:px-3 md:text-sm',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-black/5'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {ANALYTICS_PERIOD_LABELS[p]}
            </button>
          )
        })}
      </div>

      {/* Native date input, visually presented as a "Choose a date" control so
          the empty state reads intentionally instead of a locale placeholder. */}
      <label
        className={cn(
          'border-border bg-background focus-within:ring-primary/40 relative inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors focus-within:ring-2 md:text-sm',
          date === '' ? 'text-muted-foreground' : 'border-primary/50 text-foreground'
        )}
      >
        <HugeiconsIcon
          icon={Calendar03Icon}
          className="size-4 shrink-0"
          strokeWidth={1.8}
        />
        <span>{date === '' ? 'Choose a date' : formatDateLabel(date)}</span>
        <input
          type="date"
          value={date}
          onChange={(e) => onDate(e.target.value)}
          aria-label="Choose a specific date"
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  )
}

function formatDateLabel(iso: string) {
  // Parse as local midnight so the label doesn't shift a day across timezones.
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

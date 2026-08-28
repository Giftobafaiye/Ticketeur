'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons'

import type { RouterOutputs } from '@ticketur/api'
import { cn } from '@ticketur/ui/lib/utils'
import {
  CartesianGrid,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Line,
  LineChart,
  XAxis,
  YAxis,
  type ChartConfig,
} from '@ticketur/ui/components/chart'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ticketur/ui/components/table'

import { useTRPC } from '@/lib/trpc'

import type { AnalyticsRange } from './shared'

const trendConfig = {
  value: { label: 'Bookings', color: '#8b5cf6' },
} satisfies ChartConfig

const FILTERS = ['all', 'upcoming', 'completed', 'cancelled'] as const
type BookingStatus = (typeof FILTERS)[number]
const PAGE_SIZE = 6

type BookingRow =
  RouterOutputs['vendor']['analytics']['recentBookings']['rows'][number]

const STATUS_TONE: Record<string, string> = {
  completed:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  upcoming: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
}

export function AnalyticsBookingsTab({ range }: { range: AnalyticsRange }) {
  const trpc = useTRPC()
  const [status, setStatus] = useState<BookingStatus>('all')
  const [page, setPage] = useState(1)

  const bookingsQuery = useQuery(
    trpc.vendor.analytics.bookings.queryOptions({
      period: range.period,
      date: range.date,
    })
  )
  const tableQuery = useQuery(
    trpc.vendor.analytics.recentBookings.queryOptions({
      status,
      page,
      pageSize: PAGE_SIZE,
    })
  )

  const trends = bookingsQuery.data?.trends ?? []
  const funnel = bookingsQuery.data?.funnel
  const rows = tableQuery.data?.rows ?? []
  const total = tableQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function changeStatus(next: BookingStatus) {
    setStatus(next)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="border-border/60 bg-background rounded-2xl border p-5 md:p-6"
      >
        <h2 className="font-heading text-foreground text-base font-bold tracking-tight md:text-lg">
          Booking Trends
        </h2>
        {bookingsQuery.isLoading ? (
          <div className="bg-muted mt-5 aspect-[16/9] w-full animate-pulse rounded-xl md:aspect-[16/5]" />
        ) : (
          <ChartContainer
            config={trendConfig}
            className="mt-5 aspect-[16/9] w-full md:aspect-[16/5]"
          >
            <LineChart
              data={trends}
              margin={{ left: -8, right: 8, top: 8, bottom: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="4 4" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={36}
                allowDecimals={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                dataKey="value"
                type="monotone"
                stroke="var(--color-value)"
                strokeWidth={2.5}
                dot={{ r: 3, strokeWidth: 0, fill: 'var(--color-value)' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ChartContainer>
        )}
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="border-border/60 bg-background rounded-2xl border p-5 md:p-6"
      >
        <h2 className="font-heading text-foreground text-base font-bold tracking-tight md:text-lg">
          Booking Funnel
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          See where opportunities are gained or lost across your vendor journey.
        </p>

        <div className="mt-5 flex flex-col gap-1.5">
          <FunnelRow
            label="Profile Views"
            value={funnel?.profileViews ?? 0}
            tone="bg-primary/10 text-primary"
          />
          <FunnelArrow />
          <FunnelRow
            label="Invitations"
            value={funnel?.invitations ?? 0}
            tone="bg-sky-500/10 text-sky-600 dark:text-sky-400"
          />
          <FunnelArrow />
          <FunnelRow
            label="Confirmed Bookings"
            value={funnel?.confirmed ?? 0}
            tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          />
          <FunnelArrow />
          <FunnelRow
            label="Completed Events"
            value={funnel?.completed ?? 0}
            tone="bg-muted text-muted-foreground"
          />
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="border-border/60 bg-background rounded-2xl border p-5 md:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-foreground text-base font-bold tracking-tight md:text-lg">
            Recent Bookings
          </h2>
          <div className="border-border bg-background inline-flex items-center gap-1 rounded-lg border p-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => changeStatus(f)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-colors',
                  status === f
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          {tableQuery.isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-muted h-12 animate-pulse rounded-lg"
                />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No bookings to show{status === 'all' ? ' yet' : ` for “${status}”`}
              .
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Event Details
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Organizer
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Event Date
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Booking Date
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <BookingTableRow key={row.id} row={row} />
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {rows.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-muted-foreground text-xs">
              Showing {rows.length} of {total.toLocaleString()}{' '}
              {total === 1 ? 'booking' : 'bookings'}
            </span>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </motion.section>
    </div>
  )
}

function FunnelRow({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-xl px-4 py-3.5',
        tone
      )}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-foreground text-sm font-bold tabular-nums">
        {value.toLocaleString()}
      </span>
    </div>
  )
}

function FunnelArrow() {
  return (
    <div className="flex justify-center py-0.5" aria-hidden>
      <HugeiconsIcon
        icon={ArrowDown01Icon}
        className="text-muted-foreground/60 size-4"
        strokeWidth={2}
      />
    </div>
  )
}

function BookingTableRow({ row }: { row: BookingRow }) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <div
            className="bg-muted size-9 shrink-0 rounded-md bg-cover bg-center"
            style={{
              backgroundImage: row.bannerUrl
                ? `url(${row.bannerUrl})`
                : undefined,
            }}
          />
          <span className="text-foreground max-w-[220px] truncate text-sm font-medium">
            {row.eventTitle}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
        {row.organizer}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
        {formatDay(row.eventDate)}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
        {formatDay(row.bookingDate)}
      </TableCell>
      <TableCell>
        <span
          className={cn(
            'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold capitalize',
            STATUS_TONE[row.status] ?? 'bg-muted text-muted-foreground'
          )}
        >
          {row.status}
        </span>
      </TableCell>
    </TableRow>
  )
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  const pages = pageList(page, totalPages)
  return (
    <nav aria-label="Bookings pagination" className="flex items-center gap-1.5">
      <PageButton
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        ariaLabel="Previous page"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" strokeWidth={2} />
      </PageButton>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`dots-${i}`} className="text-muted-foreground px-1 text-sm">
            …
          </span>
        ) : (
          <PageButton
            key={p}
            active={p === page}
            onClick={() => onChange(p)}
            ariaLabel={`Page ${p}`}
          >
            {p}
          </PageButton>
        )
      )}
      <PageButton
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        ariaLabel="Next page"
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
  ariaLabel,
  children,
}: {
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  ariaLabel?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-lg border text-sm font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-foreground hover:border-primary hover:text-primary',
        disabled && 'pointer-events-none opacity-40'
      )}
    >
      {children}
    </button>
  )
}

function pageList(page: number, total: number): (number | '…')[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  if (page > 3) out.push('…')
  const start = Math.max(2, page - 1)
  const end = Math.min(total - 1, page + 1)
  for (let i = start; i <= end; i++) out.push(i)
  if (page < total - 2) out.push('…')
  out.push(total)
  return out
}

function formatDay(value: Date | string | null) {
  if (!value) return 'TBD'
  const d =
    value instanceof Date ? value : new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return 'TBD'
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

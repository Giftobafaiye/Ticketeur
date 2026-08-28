'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import type { IconSvgElement } from '@hugeicons/react'
import {
  CheckmarkBadge02Icon,
  CheckmarkCircle02Icon,
  Download01Icon,
  Mail01Icon,
  StarIcon,
  UserCircle02Icon,
  ViewIcon,
} from '@hugeicons/core-free-icons'

import type { RouterOutputs } from '@ticketur/api'
import { cn } from '@ticketur/ui/lib/utils'
import { Button } from '@ticketur/ui/components/button'
import { LogoIcon } from '@ticketur/ui/icons/logo-icon'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@ticketur/ui/components/dialog'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ChartContainer,
  LabelList,
  XAxis,
  type ChartConfig,
} from '@ticketur/ui/components/chart'

import { useTRPC } from '@/lib/trpc'
import { StarRating } from '@/components/sections/vendor-detail/star-rating'

import {
  ANALYTICS_PERIOD_LABELS,
  type AnalyticsRange,
  type ReportType,
  REPORT_TYPE_LABELS,
} from './shared'

const RATING_LEVELS = [5, 4, 3, 2, 1] as const

const barConfig = {
  value: { label: 'Value', color: '#8b5cf6' },
} satisfies ChartConfig

// Print just the report: hide everything else, and release the dialog's
// scroll/size constraints so the full report flows onto the page.
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #vendor-report-print, #vendor-report-print * { visibility: visible !important; }
  [data-slot="dialog-overlay"] { display: none !important; }
  [data-slot="dialog-content"] {
    position: static !important;
    transform: none !important;
    max-width: none !important;
    max-height: none !important;
    width: 100% !important;
    overflow: visible !important;
    box-shadow: none !important;
    ring-width: 0 !important;
  }
  #vendor-report-print {
    position: absolute; left: 0; top: 0; width: 100%;
    max-height: none !important; overflow: visible !important;
    background: #ffffff !important; color: #111827 !important;
  }
}
`

export function ReportPreviewModal({
  open,
  onOpenChange,
  range,
  reportType,
  vendorName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  range: AnalyticsRange
  reportType: ReportType
  vendorName: string
}) {
  const trpc = useTRPC()
  const rangeArgs = { period: range.period, date: range.date }

  const overview = useQuery(
    trpc.vendor.analytics.overview.queryOptions(rangeArgs, { enabled: open })
  )
  const bookings = useQuery(
    trpc.vendor.analytics.bookings.queryOptions(rangeArgs, { enabled: open })
  )
  const ratings = useQuery(
    trpc.vendor.analytics.ratings.queryOptions(
      { page: 1, pageSize: 1 },
      { enabled: open }
    )
  )
  const stats = useQuery(
    trpc.vendor.dashboard.stats.queryOptions(undefined, { enabled: open })
  )

  // Stamp the generation time once per open (Date is intentionally not in the
  // dependency array beyond `open`).
  const generatedAt = useMemo(
    () => new Date(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open]
  )

  const kpis = overview.data?.kpis
  const funnel = bookings.data?.funnel
  const reputation = ratings.data?.summary
  const profileCompletion = stats.data?.profileCompletion
  const viewTrends = bookings.data?.viewTrends ?? []
  const bookingTrends = bookings.data?.trends ?? []

  const rangeLabel = range.date
    ? `Ending ${range.date}`
    : ANALYTICS_PERIOD_LABELS[range.period]

  const insights = useMemo(() => {
    const out: string[] = []
    if (kpis) {
      const d = kpis.profileViews.delta
      out.push(
        `Profile views ${d >= 0 ? 'grew' : 'declined'} ${Math.abs(d)}% versus the previous period.`
      )
    }
    if (funnel && funnel.profileViews > 0) {
      const rate = ((funnel.confirmed / funnel.profileViews) * 100).toFixed(1)
      out.push(
        `Booking conversion rate stands at ${rate}% (profile views to confirmed bookings).`
      )
    }
    if (reputation && reputation.total > 0) {
      out.push(
        `Average rating of ${reputation.average.toFixed(1)} across ${reputation.total} review${reputation.total === 1 ? '' : 's'}.`
      )
    }
    if (typeof profileCompletion === 'number' && profileCompletion < 100) {
      out.push(
        `Completing the remaining ${100 - profileCompletion}% of your profile can lift your invitation rate.`
      )
    }
    if (out.length === 0) {
      out.push(
        'Not enough activity yet to surface insights — check back as bookings and reviews come in.'
      )
    }
    return out
  }, [kpis, funnel, reputation, profileCompletion])

  function downloadCsv() {
    exportReportCsv({ reportType, kpis, funnel, reputation })
  }

  const loading =
    overview.isLoading || bookings.isLoading || ratings.isLoading

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-full gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <DialogTitle className="sr-only">
          {REPORT_TYPE_LABELS[reportType]}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {vendorName} analytics report for {rangeLabel}.
        </DialogDescription>

        <div
          id="vendor-report-print"
          className="max-h-[85vh] overflow-y-auto bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100"
        >
          <style>{PRINT_CSS}</style>

          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6">
            <div className="flex items-center gap-2">
              <LogoIcon className="h-8 w-auto" />
              <span className="font-heading text-lg font-semibold tracking-tight">
                Ticketeur
              </span>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <Button
                type="button"
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5"
              >
                <HugeiconsIcon
                  icon={Download01Icon}
                  className="size-4"
                  strokeWidth={2}
                />
                Export PDF
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={downloadCsv}
                className="gap-1.5"
              >
                <HugeiconsIcon
                  icon={Download01Icon}
                  className="size-4"
                  strokeWidth={2}
                />
                Export CSV
              </Button>
            </div>
          </div>

          <div className="px-6 pt-5 pb-6">
            {/* Title block */}
            <div className="border-border/70 flex flex-wrap items-start justify-between gap-2 border-b pb-4">
              <div className="flex flex-col gap-1">
                <h2 className="font-heading text-2xl font-bold tracking-tight">
                  {REPORT_TYPE_LABELS[reportType]}
                </h2>
                <p className="text-sm text-neutral-500">
                  {vendorName} • {rangeLabel}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-neutral-500">Generated</p>
                <p className="text-sm font-semibold">
                  {generatedAt.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="mt-6 flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-20 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900"
                  />
                ))}
              </div>
            ) : (
              <>
                <Section title="Performance Overview">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <ReportStat
                      icon={ViewIcon}
                      label="Profile Views"
                      value={fmt(kpis?.profileViews.value)}
                      delta={kpis?.profileViews.delta}
                    />
                    <ReportStat
                      icon={Mail01Icon}
                      label="Events Invitations"
                      value={fmt(kpis?.invitations.value)}
                      delta={kpis?.invitations.delta}
                    />
                    <ReportStat
                      icon={CheckmarkBadge02Icon}
                      label="Confirmed Bookings"
                      value={fmt(kpis?.confirmedBookings.value)}
                      delta={kpis?.confirmedBookings.delta}
                    />
                    <ReportStat
                      icon={CheckmarkCircle02Icon}
                      label="Completed Events"
                      value={fmt(funnel?.completed)}
                    />
                    <ReportStat
                      icon={StarIcon}
                      label="Average Rating"
                      value={(kpis?.averageRating.value ?? 0).toFixed(1)}
                      delta={kpis?.averageRating.delta}
                    />
                    <ReportStat
                      icon={UserCircle02Icon}
                      label={
                        (profileCompletion ?? 0) >= 100
                          ? 'Profile Complete'
                          : 'Profile Incomplete'
                      }
                      value={`${profileCompletion ?? 0}%`}
                      progress={profileCompletion ?? 0}
                      pill={
                        (profileCompletion ?? 0) >= 100 ? undefined : 'Update Required'
                      }
                    />
                  </div>
                </Section>

                <Section title="Activity Trend">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <TrendBars title="Profile Views" data={viewTrends} />
                    <TrendBars title="Bookings" data={bookingTrends} />
                  </div>
                </Section>

                <Section title="Booking Funnel">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <FunnelTile label="Profile Views" value={funnel?.profileViews} />
                    <FunnelTile label="Invitations" value={funnel?.invitations} />
                    <FunnelTile label="Confirmed" value={funnel?.confirmed} />
                    <FunnelTile label="Completed" value={funnel?.completed} />
                  </div>
                </Section>

                <Section title="Reputation Summary">
                  <div className="grid grid-cols-[auto_1fr] gap-5 sm:gap-8">
                    <div className="flex flex-col items-start gap-1 rounded-xl bg-neutral-50 p-4 dark:bg-neutral-900">
                      <span className="font-heading text-4xl font-bold tracking-tight">
                        {reputation && reputation.average > 0
                          ? reputation.average.toFixed(1)
                          : '0.0'}
                      </span>
                      <span className="text-xs text-neutral-500">out of 5</span>
                    </div>
                    <div className="flex flex-col justify-center gap-2">
                      {RATING_LEVELS.map((level) => {
                        const count = reputation?.distribution[level] ?? 0
                        const total = reputation?.total ?? 0
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0
                        return (
                          <div key={level} className="flex items-center gap-2.5">
                            <StarRating
                              value={level}
                              size="sm"
                              className="w-[92px] shrink-0"
                            />
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                              <div
                                className="bg-primary h-full rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-8 shrink-0 text-right text-xs text-neutral-500">
                              {count}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </Section>

                <Section title="Key Insights">
                  <ol className="flex flex-col gap-2">
                    {insights.map((text, i) => (
                      <li
                        key={i}
                        className="flex gap-3 rounded-lg bg-neutral-50 px-3 py-2.5 text-sm dark:bg-neutral-900"
                      >
                        <span className="text-primary font-bold">{i + 1}</span>
                        <span className="text-neutral-700 dark:text-neutral-300">
                          {text}
                        </span>
                      </li>
                    ))}
                  </ol>
                </Section>

                <div className="mt-6 flex items-center justify-between border-t border-neutral-200 pt-3 text-[11px] text-neutral-400 dark:border-neutral-800">
                  <span>
                    Generated by Ticketeur Analytics • Vendor data is
                    confidential.
                  </span>
                  <span>Page 1 of 1</span>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="bg-primary h-4 w-1 rounded-full" />
        <h3 className="text-xs font-bold tracking-wider text-neutral-500 uppercase">
          {title}
        </h3>
      </div>
      {children}
    </section>
  )
}

function ReportStat({
  icon,
  label,
  value,
  delta,
  progress,
  pill,
}: {
  icon: IconSvgElement
  label: string
  value: string
  delta?: number
  progress?: number
  pill?: string
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50/60 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
      <div className="flex items-start justify-between">
        <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
          <HugeiconsIcon icon={icon} className="size-4" strokeWidth={1.8} />
        </span>
        {pill ? (
          <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-red-600 uppercase dark:bg-red-500/15 dark:text-red-400">
            {pill}
          </span>
        ) : null}
      </div>
      <div>
        <p className="text-xs text-neutral-500">{label}</p>
        <p className="font-heading text-xl font-bold tracking-tight">{value}</p>
        {typeof progress === 'number' ? (
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            <div
              className="bg-primary h-full rounded-full"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        ) : null}
        {typeof delta === 'number' ? (
          <p className="mt-0.5 text-[11px]">
            <span
              className={cn(
                'font-bold',
                delta >= 0 ? 'text-emerald-600' : 'text-red-600'
              )}
            >
              {delta >= 0 ? '+' : ''}
              {delta}%
            </span>{' '}
            <span className="text-neutral-400">vs last period</span>
          </p>
        ) : null}
      </div>
    </div>
  )
}

function TrendBars({
  title,
  data,
}: {
  title: string
  data: { label: string; value: number }[]
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-neutral-500">{title}</p>
      <ChartContainer config={barConfig} className="aspect-[16/9] w-full">
        <BarChart data={data} margin={{ left: 4, right: 4, top: 16, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="4 4" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]}>
            <LabelList
              dataKey="value"
              position="top"
              className="fill-neutral-500 text-[10px]"
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  )
}

function FunnelTile({ label, value }: { label: string; value?: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-neutral-200 bg-neutral-50/60 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
      <span className="font-heading text-2xl font-bold tracking-tight">
        {fmt(value)}
      </span>
      <span className="text-primary text-xs font-medium">{label}</span>
      <span className="bg-primary h-1 w-8 rounded-full" />
    </div>
  )
}

function fmt(n?: number) {
  return (n ?? 0).toLocaleString()
}

function csvCell(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

type OverviewKpis = RouterOutputs['vendor']['analytics']['overview']['kpis']
type BookingFunnel = RouterOutputs['vendor']['analytics']['bookings']['funnel']
type RatingsSummary = RouterOutputs['vendor']['analytics']['ratings']['summary']

// Shared by the modal's Export CSV button and the Reports tab's direct
// Export CSV so both produce an identical file.
export function exportReportCsv({
  reportType,
  kpis,
  funnel,
  reputation,
}: {
  reportType: ReportType
  kpis?: OverviewKpis
  funnel?: BookingFunnel
  reputation?: RatingsSummary
}) {
  const rows: string[][] = [['Section', 'Metric', 'Value']]
  if (kpis) {
    rows.push(['Performance', 'Profile Views', String(kpis.profileViews.value)])
    rows.push([
      'Performance',
      'Event Invitations',
      String(kpis.invitations.value),
    ])
    rows.push([
      'Performance',
      'Confirmed Bookings',
      String(kpis.confirmedBookings.value),
    ])
    rows.push([
      'Performance',
      'Average Rating',
      kpis.averageRating.value.toFixed(1),
    ])
  }
  if (funnel) {
    rows.push(['Funnel', 'Profile Views', String(funnel.profileViews)])
    rows.push(['Funnel', 'Invitations', String(funnel.invitations)])
    rows.push(['Funnel', 'Confirmed', String(funnel.confirmed)])
    rows.push(['Funnel', 'Completed', String(funnel.completed)])
  }
  if (reputation) {
    rows.push(['Reputation', 'Average', reputation.average.toFixed(2)])
    rows.push(['Reputation', 'Total Reviews', String(reputation.total)])
  }
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ticketeur-${reportType}-report.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

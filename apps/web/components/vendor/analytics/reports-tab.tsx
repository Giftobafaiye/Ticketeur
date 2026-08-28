'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Calendar03Icon,
  Download01Icon,
  FileChartLineIcon,
  ViewIcon,
} from '@hugeicons/core-free-icons'

import { cn } from '@ticketur/ui/lib/utils'
import { Button } from '@ticketur/ui/components/button'
import { RadioGroup, RadioGroupItem } from '@ticketur/ui/components/radio-group'

import { useTRPC } from '@/lib/trpc'

import {
  ANALYTICS_PERIOD_LABELS,
  REPORT_TYPE_DESCRIPTIONS,
  REPORT_TYPE_SHORT_LABELS,
  REPORT_TYPES,
  type AnalyticsPeriod,
  type AnalyticsRange,
  type ReportType,
} from './shared'
import { ReportPreviewModal, exportReportCsv } from './report-preview'

type DateMode = AnalyticsPeriod | 'custom'

export function AnalyticsReportsTab({
  range,
  vendorName,
}: {
  range: AnalyticsRange
  vendorName: string
}) {
  const trpc = useTRPC()
  const [dateMode, setDateMode] = useState<DateMode>(
    range.date ? 'custom' : range.period
  )
  const [customDate, setCustomDate] = useState(range.date ?? '')
  const [reportType, setReportType] = useState<ReportType>('full')
  const [previewOpen, setPreviewOpen] = useState(false)

  const resolvedRange: AnalyticsRange = {
    period: dateMode === 'custom' ? '30d' : dateMode,
    date: dateMode === 'custom' && customDate ? customDate : null,
  }
  const rangeArgs = {
    period: resolvedRange.period,
    date: resolvedRange.date,
  }

  // These share query keys with the preview modal, so React Query fetches each
  // once and both surfaces read the same cache — the direct Export CSV below
  // and the modal's Export CSV produce identical output.
  const overview = useQuery(
    trpc.vendor.analytics.overview.queryOptions(rangeArgs)
  )
  const bookings = useQuery(
    trpc.vendor.analytics.bookings.queryOptions(rangeArgs)
  )
  const ratings = useQuery(
    trpc.vendor.analytics.ratings.queryOptions({ page: 1, pageSize: 1 })
  )

  const rangeLabelText =
    dateMode === 'custom'
      ? customDate
        ? `Ending ${customDate}`
        : 'Custom date'
      : ANALYTICS_PERIOD_LABELS[dateMode]

  function handleExportCsv() {
    exportReportCsv({
      reportType,
      kpis: overview.data?.kpis,
      funnel: bookings.data?.funnel,
      reputation: ratings.data?.summary,
    })
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
          Generate Report
        </h2>

        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
          <div>
            <p className="text-foreground text-sm font-semibold">Date Range</p>
            <RadioGroup
              value={dateMode}
              onValueChange={(v) => setDateMode(v as DateMode)}
              className="mt-3 flex flex-col gap-2.5"
            >
              <DateRadioRow value="7d" label="Last 7 days" active={dateMode === '7d'} />
              <DateRadioRow
                value="30d"
                label="Last 30 days"
                active={dateMode === '30d'}
              />
              <DateRadioRow
                value="90d"
                label="Last 90 days"
                active={dateMode === '90d'}
              />
              <label
                htmlFor="dr-custom"
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
                  dateMode === 'custom'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                )}
              >
                <RadioGroupItem value="custom" id="dr-custom" />
                <span className="text-muted-foreground flex items-center gap-2 text-sm">
                  <HugeiconsIcon
                    icon={Calendar03Icon}
                    className="size-4 shrink-0"
                    strokeWidth={1.8}
                  />
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => {
                      setCustomDate(e.target.value)
                      setDateMode('custom')
                    }}
                    onFocus={() => setDateMode('custom')}
                    aria-label="Choose a specific date"
                    className="bg-transparent text-sm outline-none [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </span>
              </label>
            </RadioGroup>
          </div>

          <div>
            <p className="text-foreground text-sm font-semibold">Report Type</p>
            <RadioGroup
              value={reportType}
              onValueChange={(v) => setReportType(v as ReportType)}
              className="mt-3 flex flex-col gap-2.5"
            >
              {REPORT_TYPES.map((t) => {
                const active = reportType === t
                return (
                  <label
                    key={t}
                    htmlFor={`rt-${t}`}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors',
                      active
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40'
                    )}
                  >
                    <RadioGroupItem value={t} id={`rt-${t}`} className="mt-0.5" />
                    <div className="flex flex-col gap-0.5">
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          active ? 'text-primary' : 'text-foreground'
                        )}
                      >
                        {REPORT_TYPE_SHORT_LABELS[t]}
                      </span>
                      <span className="text-muted-foreground text-xs leading-relaxed">
                        {REPORT_TYPE_DESCRIPTIONS[t]}
                      </span>
                    </div>
                  </label>
                )
              })}
            </RadioGroup>
          </div>
        </div>

        <div className="border-border/60 mt-6 flex flex-wrap items-center justify-between gap-4 border-t pt-5">
          <div className="flex items-center gap-2 text-sm">
            <HugeiconsIcon
              icon={FileChartLineIcon}
              className="text-primary size-4 shrink-0"
              strokeWidth={1.8}
            />
            <span className="text-foreground font-semibold">
              {REPORT_TYPE_SHORT_LABELS[reportType]}:
            </span>
            <span className="text-muted-foreground">{rangeLabelText}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPreviewOpen(true)}
              className="gap-1.5"
            >
              <HugeiconsIcon icon={ViewIcon} className="size-4" strokeWidth={2} />
              Preview Report
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setPreviewOpen(true)}
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
              onClick={handleExportCsv}
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
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="border-border/60 bg-background rounded-2xl border p-5 md:p-6"
      >
        <h2 className="font-heading text-foreground text-base font-bold tracking-tight md:text-lg">
          Historical Report
        </h2>
        <div className="border-border bg-muted/30 mt-4 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-center">
          <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
            <HugeiconsIcon
              icon={FileChartLineIcon}
              className="size-6"
              strokeWidth={1.6}
            />
          </span>
          <p className="text-foreground text-sm font-semibold">
            No saved reports yet
          </p>
          <p className="text-muted-foreground max-w-sm text-sm leading-6">
            Reports you generate download straight to your device. Saved report
            history is coming soon.
          </p>
        </div>
      </motion.section>

      <ReportPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        range={resolvedRange}
        reportType={reportType}
        vendorName={vendorName}
      />
    </div>
  )
}

function DateRadioRow({
  value,
  label,
  active,
}: {
  value: string
  label: string
  active: boolean
}) {
  return (
    <label
      htmlFor={`dr-${value}`}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
        active
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/40'
      )}
    >
      <RadioGroupItem value={value} id={`dr-${value}`} />
      <span
        className={cn(
          'text-sm font-medium',
          active ? 'text-primary' : 'text-foreground'
        )}
      >
        {label}
      </span>
    </label>
  )
}

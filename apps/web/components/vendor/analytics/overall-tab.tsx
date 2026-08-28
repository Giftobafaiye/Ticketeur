'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import type { IconSvgElement } from '@hugeicons/react'
import {
  CheckmarkBadge02Icon,
  CheckmarkCircle02Icon,
  Mail01Icon,
  StarIcon,
  ViewIcon,
} from '@hugeicons/core-free-icons'

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

import { useTRPC } from '@/lib/trpc'
import { VendorStatCard } from '@/components/vendor/stat-card'

import type { AnalyticsRange } from './shared'

const chartConfig = {
  profileViews: { label: 'Profile views', color: '#8b5cf6' },
  invitations: { label: 'Invitations', color: '#3b82f6' },
  bookings: { label: 'Bookings', color: '#22c55e' },
} satisfies ChartConfig

const ACTIVITY_META: Record<
  'invitation' | 'review' | 'completed',
  { icon: IconSvgElement; tone: string }
> = {
  invitation: {
    icon: Mail01Icon,
    tone: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
  },
  completed: {
    icon: CheckmarkCircle02Icon,
    tone: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  },
  review: {
    icon: StarIcon,
    tone: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  },
}

export function AnalyticsOverallTab({ range }: { range: AnalyticsRange }) {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(
    trpc.vendor.analytics.overview.queryOptions({
      period: range.period,
      date: range.date,
    })
  )

  const kpis = data?.kpis
  const activity = data?.activity ?? []
  const recentActivity = data?.recentActivity ?? []

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <VendorStatCard
          label="Profile Views"
          value={fmt(kpis?.profileViews.value)}
          icon={ViewIcon}
          tone="purple"
          delta={kpis?.profileViews.delta}
        />
        <VendorStatCard
          label="Event Invitations"
          value={fmt(kpis?.invitations.value)}
          icon={Mail01Icon}
          tone="blue"
          delta={kpis?.invitations.delta}
        />
        <VendorStatCard
          label="Confirmed Bookings"
          value={fmt(kpis?.confirmedBookings.value)}
          icon={CheckmarkBadge02Icon}
          tone="green"
          delta={kpis?.confirmedBookings.delta}
        />
        <VendorStatCard
          label="Average Rating"
          value={(kpis?.averageRating.value ?? 0).toFixed(1)}
          icon={StarIcon}
          tone="orange"
          delta={kpis?.averageRating.delta}
        />
      </div>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="border-border/60 bg-background rounded-2xl border p-5 md:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-foreground text-base font-bold tracking-tight md:text-lg">
            Business Activity
          </h2>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {Object.entries(chartConfig).map(([key, cfg]) => (
              <li
                key={key}
                className="text-muted-foreground flex items-center gap-1.5 text-xs"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: cfg.color }}
                />
                {cfg.label}
              </li>
            ))}
          </ul>
        </div>

        {isLoading ? (
          <div className="bg-muted mt-5 aspect-[16/9] w-full animate-pulse rounded-xl md:aspect-[16/6]" />
        ) : (
          <ChartContainer
            config={chartConfig}
            className="mt-5 aspect-[16/9] w-full md:aspect-[16/6]"
          >
            <LineChart
              data={activity}
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
                dataKey="profileViews"
                type="monotone"
                stroke="var(--color-profileViews)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                dataKey="invitations"
                type="monotone"
                stroke="var(--color-invitations)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                dataKey="bookings"
                type="monotone"
                stroke="var(--color-bookings)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ChartContainer>
        )}
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="border-border/60 bg-background rounded-2xl border p-5 md:p-6"
      >
        <h2 className="font-heading text-foreground text-base font-bold tracking-tight md:text-lg">
          Recent Activity
        </h2>

        {isLoading ? (
          <div className="mt-4 flex flex-col gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-muted h-12 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : recentActivity.length === 0 ? (
          <p className="text-muted-foreground mt-4 text-sm">
            No recent activity yet — invitations, completed events, and reviews
            will show up here.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {recentActivity.map((item, i) => {
              const meta = ACTIVITY_META[item.type]
              return (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full',
                      meta.tone
                    )}
                  >
                    <HugeiconsIcon
                      icon={meta.icon}
                      className="size-4"
                      strokeWidth={1.8}
                    />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-foreground text-sm">
                      {item.message}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {relativeTime(item.at)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </motion.section>
    </div>
  )
}

function fmt(n?: number) {
  return (n ?? 0).toLocaleString()
}

function relativeTime(value: Date | string) {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

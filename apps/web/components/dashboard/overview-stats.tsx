'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Calendar03Icon,
  CheckmarkCircle02Icon,
  Ticket01Icon,
  Money01Icon,
} from '@hugeicons/core-free-icons'

import { useTRPC } from '@/lib/trpc'
import { formatNaira } from '@/lib/event-display'

import { StatCard } from './stat-card'

export function OverviewStats() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.org.dashboard.stats.queryOptions())

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Events"
        value={data ? data.totalEvents.toLocaleString() : '0'}
        icon={Calendar03Icon}
        tone="purple"
        loading={isLoading}
      />
      <StatCard
        label="Published Events"
        value={data ? data.publishedEvents.toLocaleString() : '0'}
        icon={CheckmarkCircle02Icon}
        tone="green"
        loading={isLoading}
      />
      <StatCard
        label="Total Tickets Sold"
        value={data ? data.ticketsSold.toLocaleString() : '0'}
        icon={Ticket01Icon}
        tone="blue"
        loading={isLoading}
      />
      <StatCard
        label="Total Earnings"
        value={data ? formatNaira(data.revenueMinor) : '₦0'}
        icon={Money01Icon}
        tone="orange"
        loading={isLoading}
      />
    </div>
  )
}

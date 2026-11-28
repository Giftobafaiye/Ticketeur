'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Wallet01Icon,
} from '@hugeicons/core-free-icons'

import { formatNaira } from '@ticketur/db/payouts/format'

import { useTRPC } from '@/lib/trpc'
import { StatCard } from '@/components/dashboard/stat-card'

const MODE_COPY = {
  off: 'Payouts are OFF. Organizers can see their balances but cannot ask to withdraw. Set PAYOUTS_MODE to "manual" or "live" to open them.',
  manual:
    'Payouts are MANUAL. Approve a request, send the money from the Flutterwave dashboard, then record it as paid here.',
  live: 'Payouts are LIVE. Approving a request sends the transfer automatically.',
} as const

export function PayoutsStats() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.admin.payouts.stats.queryOptions())

  return (
    <section aria-label="Payouts" className="flex flex-col gap-4">
      {data ? (
        <p className="border-border/60 bg-muted/40 text-foreground rounded-xl border px-4 py-3 text-sm">
          {MODE_COPY[data.mode]}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Requests needing you"
          value={data ? data.needsAction.toLocaleString('en-US') : '—'}
          icon={Alert02Icon}
          tone="orange"
          badge={data && data.needsAction > 0 ? 'Action needed' : undefined}
          loading={isLoading}
        />
        <StatCard
          label="Organizers can withdraw"
          value={data ? formatNaira(data.availableMinor) : '—'}
          icon={Wallet01Icon}
          tone="green"
          loading={isLoading}
        />
        <StatCard
          label="On hold until events end"
          value={data ? formatNaira(data.heldMinor) : '—'}
          icon={Clock01Icon}
          tone="blue"
          loading={isLoading}
        />
        <StatCard
          label="Paid out"
          value={data ? formatNaira(data.paidOutMinor) : '—'}
          icon={CheckmarkCircle02Icon}
          tone="purple"
          loading={isLoading}
        />
      </div>
    </section>
  )
}

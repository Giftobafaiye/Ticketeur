'use client'

import { useQuery } from '@tanstack/react-query'
import {
  CheckmarkCircle02Icon,
  Clock01Icon,
  MoneySend01Icon,
  Wallet01Icon,
} from '@hugeicons/core-free-icons'

import { formatNaira } from '@ticketur/db/payouts/format'

import { useTRPC } from '@/lib/trpc'
import { formatShortDate } from '@/lib/date'
import { StatCard } from '@/components/dashboard/stat-card'
import { PayoutStatusBadge } from '@/components/dashboard/payouts/payout-status'

// The organizer's Payouts page. Everything on it comes from one query
// (org.payouts.overview) so the numbers on the cards, the per-event lines and
// the withdrawal history are always the same snapshot.

export function OrgPayoutsContent() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(
    trpc.org.payouts.overview.queryOptions()
  )

  const summary = data?.summary

  return (
    <div className="flex min-h-0 flex-1 [scrollbar-width:none] flex-col gap-6 overflow-y-auto md:gap-8 [&::-webkit-scrollbar]:hidden">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight md:text-[28px]">
          Payouts
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          What your events have earned, and withdrawing it to your bank.
        </p>
      </header>

      {data && data.mode === 'off' ? (
        <p className="border-border bg-muted/40 text-foreground rounded-xl border px-4 py-3 text-sm">
          Withdrawals open soon. Until then you can see everything your events
          have earned below.
        </p>
      ) : null}

      <section
        aria-label="Balance"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Available to withdraw"
          value={summary ? formatNaira(summary.withdrawableMinor) : '—'}
          icon={Wallet01Icon}
          tone="green"
          loading={isLoading}
        />
        <StatCard
          label="On hold"
          value={summary ? formatNaira(summary.heldMinor) : '—'}
          icon={Clock01Icon}
          tone="orange"
          loading={isLoading}
        />
        <StatCard
          label="In progress"
          value={summary ? formatNaira(summary.inProgressMinor) : '—'}
          icon={MoneySend01Icon}
          tone="blue"
          loading={isLoading}
        />
        <StatCard
          label="Paid out"
          value={summary ? formatNaira(summary.paidOutMinor) : '—'}
          icon={CheckmarkCircle02Icon}
          tone="purple"
          loading={isLoading}
        />
      </section>

      {summary && summary.availableMinor < 0 ? (
        <p className="border-destructive/30 bg-destructive/5 text-foreground rounded-xl border px-4 py-3 text-sm">
          Your balance is {formatNaira(summary.availableMinor)}: a refund or
          correction came in after money had already been paid out. New
          earnings cover it first.
        </p>
      ) : null}

      <EarningsByEvent
        loading={isLoading}
        events={data?.events ?? []}
        earlyRelease={summary?.earlyRelease ?? false}
        holdDays={data?.rules.holdDays ?? 1}
        adjustmentsMinor={summary?.adjustmentsMinor ?? 0}
      />

      <PayoutHistory loading={isLoading} payouts={data?.payouts ?? []} />
    </div>
  )
}

type EventLine = {
  eventId: string
  title: string
  lastDay: string | null
  paidOrders: number
  earnedMinor: number
  releaseDate: string | null
  released: boolean
}

function EarningsByEvent({
  loading,
  events,
  earlyRelease,
  holdDays,
  adjustmentsMinor,
}: {
  loading: boolean
  events: EventLine[]
  earlyRelease: boolean
  holdDays: number
  adjustmentsMinor: number
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-foreground text-lg font-semibold">
          Earnings by event
        </h2>
        <p className="text-muted-foreground text-sm">
          Your share is the price of every paid ticket, registration and vote,
          after any discount. The service fee buyers pay on top goes to
          Ticketeur.{' '}
          {earlyRelease
            ? 'Your earnings can be withdrawn as soon as they are paid.'
            : `Money from an event can be withdrawn ${holdDays === 1 ? 'the day' : `${holdDays} days`} after it ends.`}
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-muted h-14 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-xl border border-dashed p-8 text-center text-sm">
          No paid orders yet. Earnings appear here as soon as a buyer pays.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((e) => (
            <li
              key={e.eventId}
              className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-heading text-foreground truncate font-semibold">
                  {e.title}
                </span>
                <span className="text-muted-foreground text-xs">
                  {e.paidOrders.toLocaleString('en-US')} paid{' '}
                  {e.paidOrders === 1 ? 'order' : 'orders'}
                  {e.lastDay ? ` · ends ${formatShortDate(e.lastDay)}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-heading text-foreground font-semibold">
                  {formatNaira(e.earnedMinor)}
                </span>
                {e.released ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    Available
                  </span>
                ) : (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                    {e.releaseDate
                      ? `On hold until ${formatShortDate(e.releaseDate)}`
                      : 'On hold until the event is dated'}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {adjustmentsMinor !== 0 ? (
        <p className="text-muted-foreground text-sm">
          Adjustments:{' '}
          <span className="text-foreground font-semibold">
            {formatNaira(adjustmentsMinor)}
          </span>{' '}
          — money already paid to you outside Ticketeur, or a correction from
          our team.
        </p>
      ) : null}
    </section>
  )
}

type PayoutLine = {
  id: string
  amountMinor: number
  status: Parameters<typeof PayoutStatusBadge>[0]['status']
  bankName: string
  accountNumberMasked: string
  requestedAt: Date
  paidAt: Date | null
  note: string
}

function PayoutHistory({
  loading,
  payouts,
}: {
  loading: boolean
  payouts: PayoutLine[]
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-foreground text-lg font-semibold">
        Withdrawals
      </h2>
      {loading ? (
        <div className="bg-muted h-16 animate-pulse rounded-xl" />
      ) : payouts.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-xl border border-dashed p-8 text-center text-sm">
          No withdrawals yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {payouts.map((p) => (
            <li
              key={p.id}
              className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-heading text-foreground font-semibold">
                    {formatNaira(p.amountMinor)}
                  </span>
                  <PayoutStatusBadge status={p.status} />
                </div>
                <span className="text-muted-foreground text-xs">
                  {p.bankName} {p.accountNumberMasked} · requested{' '}
                  {formatShortDate(p.requestedAt)}
                  {p.paidAt ? ` · paid ${formatShortDate(p.paidAt)}` : ''}
                </span>
                {p.note ? (
                  <span className="text-muted-foreground text-xs">
                    {p.note}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

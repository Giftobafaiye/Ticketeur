'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  BankIcon,
  CheckmarkCircle02Icon,
  Coins01Icon,
  MoneySend01Icon,
  Wallet01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { Button } from '@ticketur/ui/components/button'
import { formatNaira } from '@ticketur/db/payouts/format'

import { useTRPC } from '@/lib/trpc'
import { formatShortDate } from '@/lib/date'
import { StatCard } from '@/components/dashboard/stat-card'
import { PayoutStatusBadge } from '@/components/dashboard/payouts/payout-status'
import { BankAccountDialog } from '@/components/dashboard/payouts/bank-account-dialog'
import { WithdrawDialog } from '@/components/dashboard/payouts/withdraw-dialog'

// The organizer's Payouts page. Everything on it comes from one query
// (org.payouts.overview), so the cards, the per-event lines, the account and
// the withdrawal history are always the same snapshot.

function formatDateTime(value: Date): string {
  return value.toLocaleString('en-NG', {
    timeZone: 'Africa/Lagos',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function OrgPayoutsContent() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(
    trpc.org.payouts.overview.queryOptions()
  )
  const [accountOpen, setAccountOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  const summary = data?.summary
  const account = data?.account ?? null
  const now = new Date()
  const coolingUntil =
    account && account.usableFrom > now ? account.usableFrom : null

  // Why the Withdraw button is unavailable, in words — or null when it is.
  const blocked = !data
    ? 'Loading…'
    : !account
      ? 'Add a bank account first.'
      : coolingUntil
        ? `Your new account can receive money from ${formatDateTime(coolingUntil)}.`
        : data.hasOpenPayout
          ? 'You have a withdrawal in progress.'
          : (summary?.withdrawableMinor ?? 0) < data.rules.minPayoutMinor
            ? 'Nothing available to withdraw yet.'
            : null

  return (
    <div className="flex min-h-0 flex-1 [scrollbar-width:none] flex-col gap-6 overflow-y-auto md:gap-8 [&::-webkit-scrollbar]:hidden">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight md:text-[28px]">
            Payouts
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            What your events have earned, and withdrawing it to your bank.
          </p>
        </div>
        {data?.canRequest ? (
          <div className="flex flex-col items-stretch gap-1 md:items-end">
            <Button
              size="xl"
              className="w-full md:w-auto"
              disabled={Boolean(blocked)}
              onClick={() => setWithdrawOpen(true)}
            >
              Withdraw
            </Button>
            {blocked && data ? (
              <span className="text-muted-foreground text-xs">{blocked}</span>
            ) : null}
          </div>
        ) : null}
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
          label="Total earned"
          value={summary ? formatNaira(summary.earnedMinor) : '—'}
          icon={Coins01Icon}
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

      {data?.canRequest ? (
        <section className="border-border bg-card flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
              <HugeiconsIcon icon={BankIcon} className="size-5" strokeWidth={1.8} />
            </span>
            {account ? (
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-heading text-foreground font-semibold">
                  {account.accountName}
                </span>
                <span className="text-muted-foreground text-sm">
                  {account.bankName} {account.accountNumberMasked}
                </span>
                {coolingUntil ? (
                  <span className="text-xs text-orange-600 dark:text-orange-400">
                    New account: can receive money from{' '}
                    {formatDateTime(coolingUntil)}.
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                <span className="font-heading text-foreground font-semibold">
                  No bank account yet
                </span>
                <span className="text-muted-foreground text-sm">
                  Add the account your earnings should be paid into.
                </span>
              </div>
            )}
          </div>
          <Button variant="outline" onClick={() => setAccountOpen(true)}>
            {account ? 'Change account' : 'Add bank account'}
          </Button>
        </section>
      ) : null}

      <EarningsByEvent
        loading={isLoading}
        events={data?.events ?? []}
        adjustmentsMinor={summary?.adjustmentsMinor ?? 0}
      />

      <PayoutHistory
        loading={isLoading}
        payouts={data?.payouts ?? []}
        canCancel={Boolean(data?.canRequest)}
      />

      <BankAccountDialog
        open={accountOpen}
        onOpenChange={setAccountOpen}
        replacing={Boolean(account)}
      />
      {account && summary && data ? (
        <WithdrawDialog
          open={withdrawOpen}
          onOpenChange={setWithdrawOpen}
          withdrawableMinor={summary.withdrawableMinor}
          minPayoutMinor={data.rules.minPayoutMinor}
          account={account}
        />
      ) : null}
    </div>
  )
}

type EventLine = {
  eventId: string
  title: string
  lastDay: string | null
  paidOrders: number
  earnedMinor: number
}

function EarningsByEvent({
  loading,
  events,
  adjustmentsMinor,
}: {
  loading: boolean
  events: EventLine[]
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
          Ticketeur. Your earnings can be withdrawn as soon as a buyer pays.
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
              <span className="font-heading text-foreground font-semibold">
                {formatNaira(e.earnedMinor)}
              </span>
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
  canCancel: boolean
}

function PayoutHistory({
  loading,
  payouts,
  canCancel,
}: {
  loading: boolean
  payouts: PayoutLine[]
  canCancel: boolean
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const cancel = useMutation(
    trpc.org.payouts.cancel.mutationOptions({
      onSuccess: () => {
        toast.success('Withdrawal cancelled')
        setConfirmId(null)
        void queryClient.invalidateQueries({
          queryKey: trpc.org.payouts.overview.queryKey(),
        })
      },
      onError: (err) => {
        setConfirmId(null)
        toast.error('Could not cancel', { description: err.message })
      },
    })
  )

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
                  <span className="text-muted-foreground text-xs">{p.note}</span>
                ) : null}
              </div>
              {canCancel && p.canCancel ? (
                <Button
                  type="button"
                  size="sm"
                  variant={confirmId === p.id ? 'destructive' : 'outline'}
                  disabled={cancel.isPending}
                  onClick={() =>
                    confirmId === p.id
                      ? cancel.mutate({ payoutId: p.id })
                      : setConfirmId(p.id)
                  }
                >
                  {confirmId === p.id ? 'Confirm cancel' : 'Cancel request'}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

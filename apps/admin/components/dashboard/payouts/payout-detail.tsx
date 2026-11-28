'use client'

import { useState } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { cn } from '@ticketur/ui/lib/utils'
import { Button } from '@ticketur/ui/components/button'
import { Input } from '@ticketur/ui/components/input'
import { Textarea } from '@ticketur/ui/components/textarea'
import { formatNaira } from '@ticketur/db/payouts/format'

import { useTRPC } from '@/lib/trpc'
import { formatShortDate } from '@/lib/date'
import { BackButton } from '@/components/dashboard/users/back-button'
import {
  PAYOUT_STATUS_LABEL,
  PayoutStatusBadge,
} from '@/components/dashboard/payouts/status'

// One withdrawal request, with everything needed to decide it: where the
// money would go and whether that account looks like the organizer's, whether
// their balance still covers it, and what has happened to it so far.

function formatDateTime(value: Date): string {
  return value.toLocaleString('en-NG', {
    timeZone: 'Africa/Lagos',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

const NAME_MATCH = {
  match: {
    label: 'Name matches the profile',
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  },
  partial: {
    label: 'Name partly matches the profile',
    tone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  },
  none: {
    label: 'Name does not match the profile — check before paying',
    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
  },
} as const

export function PayoutDetail({ id }: { id: string }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useQuery(
    trpc.admin.payouts.byId.queryOptions({ id })
  )

  function refresh() {
    void queryClient.invalidateQueries({
      queryKey: trpc.admin.payouts.byId.queryKey({ id }),
    })
    void queryClient.invalidateQueries({ queryKey: trpc.admin.payouts.list.queryKey() })
    void queryClient.invalidateQueries({ queryKey: trpc.admin.payouts.stats.queryKey() })
    void queryClient.invalidateQueries({ queryKey: trpc.admin.payouts.openCount.queryKey() })
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="bg-muted h-9 w-32 animate-pulse rounded-md" />
        <div className="bg-muted h-32 animate-pulse rounded-2xl" />
        <div className="bg-muted h-48 animate-pulse rounded-2xl" />
      </div>
    )
  }
  if (isError || !data) notFound()

  const { payout, profile, balance, actions } = data
  const match = NAME_MATCH[data.nameMatch]
  const youngAccount =
    data.accountAgeHours !== null && data.accountAgeHours < 72

  return (
    <>
      <BackButton label="Back" />

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-foreground text-3xl font-bold tracking-tight">
            {formatNaira(payout.amountMinor)}
          </h1>
          <PayoutStatusBadge status={payout.status} />
        </div>
        <p className="text-muted-foreground text-sm md:text-base">
          Requested {formatDateTime(payout.requestedAt)} by{' '}
          <Link
            href={`/payouts/organizers/${payout.organizerId}`}
            className="text-primary font-semibold hover:underline"
          >
            {payout.organizerName || payout.organizerEmail}
          </Link>{' '}
          · {payout.organizerEmail}
        </p>
        {data.isSelf ? (
          <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
            This is your own withdrawal. Another admin has to decide it.
          </p>
        ) : null}
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Pay to">
          <Row label="Account name" value={payout.accountName} strong />
          <Row label="Bank" value={`${payout.bankName} (code ${payout.bankCode})`} />
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Account number</span>
            <span className="flex items-center gap-2">
              <span className="text-foreground font-mono font-semibold">
                {payout.accountNumber}
              </span>
              <button
                type="button"
                className="text-primary text-xs font-semibold hover:underline"
                onClick={() => {
                  void navigator.clipboard.writeText(payout.accountNumber)
                  toast.success('Account number copied')
                }}
              >
                Copy
              </button>
            </span>
          </div>
          <span className={cn('w-fit rounded-md px-2 py-0.5 text-xs font-semibold', match.tone)}>
            {match.label}
          </span>
          <p className="text-muted-foreground text-xs">
            Profile: {profile ? [profile.orgName, profile.name].filter(Boolean).join(' · ') : 'account deleted'}
          </p>
          {data.accountAgeHours !== null ? (
            <p
              className={cn(
                'text-xs',
                youngAccount
                  ? 'font-semibold text-amber-700 dark:text-amber-400'
                  : 'text-muted-foreground'
              )}
            >
              This account was added {data.accountAgeHours} hours before the
              request.
              {youngAccount
                ? ' A recently changed account is the usual sign of a takeover — be sure it is genuine.'
                : ''}
            </p>
          ) : null}
        </Card>

        <Card title="Their balance">
          <Row label="Earned in total" value={formatNaira(balance.earnedMinor)} />
          <Row label="On hold" value={formatNaira(balance.heldMinor)} />
          <Row label="Adjustments" value={formatNaira(balance.adjustmentsMinor)} />
          <Row label="Paid out before" value={formatNaira(balance.paidOutMinor)} />
          <Row label="In progress (incl. this)" value={formatNaira(balance.inProgressMinor)} />
          <Row label="Available after this" value={formatNaira(balance.availableMinor)} strong />
          <span
            className={cn(
              'w-fit rounded-md px-2 py-0.5 text-xs font-semibold',
              data.covers
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                : 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400'
            )}
          >
            {data.covers ? 'Balance covers this' : 'Balance does not cover this'}
          </span>
        </Card>
      </section>

      {payout.failureReason ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {payout.failureReason}
        </p>
      ) : null}

      <Actions
        id={id}
        data={data}
        latestReference={data.transfers[data.transfers.length - 1]?.reference ?? null}
        onDone={refresh}
      />

      {data.transfers.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-foreground text-lg font-semibold">
            Transfer attempts
          </h2>
          <ul className="flex flex-col gap-2">
            {data.transfers.map((t) => (
              <li
                key={t.id}
                className="border-border/60 bg-background flex flex-col gap-1 rounded-xl border p-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-foreground font-semibold">
                    Attempt {t.attempt} · {t.status}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatDateTime(t.createdAt)}
                  </span>
                </div>
                <span className="text-muted-foreground font-mono text-xs">
                  {t.reference}
                  {t.flwTransferId ? ` · Flutterwave #${t.flwTransferId}` : ''}
                  {t.feeMinor !== null ? ` · fee ${formatNaira(t.feeMinor)}` : ''}
                </span>
                {t.completeMessage || t.lastError ? (
                  <span className="text-muted-foreground text-xs">
                    {t.completeMessage || t.lastError}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-foreground text-lg font-semibold">History</h2>
        <ol className="flex flex-col gap-2">
          {data.history.map((h) => (
            <li
              key={h.id}
              className="border-border/60 bg-background flex flex-wrap items-center justify-between gap-2 rounded-xl border p-4 text-sm"
            >
              <span className="text-foreground">
                {h.fromStatus
                  ? `${PAYOUT_STATUS_LABEL[h.fromStatus]} → ${PAYOUT_STATUS_LABEL[h.toStatus]}`
                  : 'Requested'}
                <span className="text-muted-foreground">
                  {' '}
                  · {h.actorName || h.actorType}
                </span>
                {h.note ? (
                  <span className="text-muted-foreground block text-xs">{h.note}</span>
                ) : null}
              </span>
              <span className="text-muted-foreground text-xs">
                {formatDateTime(h.createdAt)}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-border/60 bg-background flex flex-col gap-3 rounded-2xl border p-5">
      <h2 className="font-heading text-foreground text-base font-semibold">{title}</h2>
      {children}
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('text-foreground text-right', strong && 'font-semibold')}>
        {value}
      </span>
    </div>
  )
}

function Actions({
  id,
  data,
  latestReference,
  onDone,
}: {
  id: string
  latestReference: string | null
  data: {
    mode: 'off' | 'manual' | 'live'
    payout: { amountMinor: number }
    actions: {
      canApprove: boolean
      canReject: boolean
      canMarkPaid: boolean
      canRetry: boolean
      canResolveUnconfirmed: boolean
    }
  }
  onDone: () => void
}) {
  const trpc = useTRPC()
  const [confirmApprove, setConfirmApprove] = useState(false)
  const [reference, setReference] = useState('')
  const [reason, setReason] = useState('')

  const approve = useMutation(
    trpc.admin.payouts.approve.mutationOptions({
      onSuccess: (res) => {
        toast.success(
          res.mode === 'live'
            ? 'Approved — the transfer is being sent'
            : 'Approved — now send it from Flutterwave and record it'
        )
        setConfirmApprove(false)
        onDone()
      },
      onError: (err) => {
        setConfirmApprove(false)
        toast.error('Could not approve', { description: err.message })
      },
    })
  )
  const markPaid = useMutation(
    trpc.admin.payouts.markPaid.mutationOptions({
      onSuccess: () => {
        toast.success('Recorded as paid')
        setReference('')
        onDone()
      },
      onError: (err) => toast.error('Could not record it', { description: err.message }),
    })
  )
  const reject = useMutation(
    trpc.admin.payouts.reject.mutationOptions({
      onSuccess: () => {
        toast.success('Rejected — the organizer has been told why')
        setReason('')
        onDone()
      },
      onError: (err) => toast.error('Could not reject', { description: err.message }),
    })
  )

  const retry = useMutation(
    trpc.admin.payouts.retry.mutationOptions({
      onSuccess: () => {
        toast.success('Sending again as a new attempt')
        onDone()
      },
      onError: (err) => toast.error('Could not retry', { description: err.message }),
    })
  )
  const [typedReference, setTypedReference] = useState('')
  const resolve = useMutation(
    trpc.admin.payouts.resolveUnconfirmed.mutationOptions({
      onSuccess: (_res, vars) => {
        toast.success(
          vars.outcome === 'paid'
            ? 'Recorded as paid'
            : 'Recorded as not sent — you can retry it now'
        )
        setTypedReference('')
        onDone()
      },
      onError: (err) =>
        toast.error('Could not record it', { description: err.message }),
    })
  )

  const { actions } = data
  const amount = formatNaira(data.payout.amountMinor)
  if (
    !actions.canApprove &&
    !actions.canMarkPaid &&
    !actions.canReject &&
    !actions.canRetry &&
    !actions.canResolveUnconfirmed
  ) {
    return null
  }

  return (
    <section className="border-border/60 bg-background flex flex-col gap-5 rounded-2xl border p-5">
      <h2 className="font-heading text-foreground text-base font-semibold">Decide</h2>

      {actions.canResolveUnconfirmed && latestReference ? (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-500/10">
          <p className="text-foreground text-sm">
            Flutterwave never confirmed this transfer. Search for reference{' '}
            <span className="font-mono font-semibold">{latestReference}</span>{' '}
            in the Flutterwave dashboard (Transfers), then record what you see.
            The sweep keeps checking on its own every 15 minutes.
          </p>
          <Input
            value={typedReference}
            onChange={(e) => setTypedReference(e.target.value)}
            placeholder="Type the reference to confirm you checked"
            disabled={resolve.isPending}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={typedReference.trim() !== latestReference || resolve.isPending}
              onClick={() =>
                resolve.mutate({ id, outcome: 'paid', reference: typedReference.trim() })
              }
            >
              It was paid
            </Button>
            <Button
              variant="destructive"
              disabled={typedReference.trim() !== latestReference || resolve.isPending}
              onClick={() =>
                resolve.mutate({
                  id,
                  outcome: 'not_sent',
                  reference: typedReference.trim(),
                })
              }
            >
              No such transfer — it was not sent
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Only choose “not sent” if the dashboard has no transfer with this
            reference. If it does and it is still pending, wait.
          </p>
        </div>
      ) : null}

      {actions.canRetry ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={retry.isPending} onClick={() => retry.mutate({ id })}>
            {retry.isPending ? 'Retrying…' : `Retry transfer of ${amount}`}
          </Button>
          <span className="text-muted-foreground text-sm">
            Sends a new transfer with a new reference. The last one failed
            definitively, so this cannot pay twice.
          </span>
        </div>
      ) : null}

      {actions.canApprove ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={approve.isPending}
            onClick={() =>
              confirmApprove ? approve.mutate({ id }) : setConfirmApprove(true)
            }
          >
            {approve.isPending
              ? 'Approving…'
              : confirmApprove
                ? `Confirm: approve ${amount}`
                : 'Approve'}
          </Button>
          <span className="text-muted-foreground text-sm">
            {data.mode === 'live'
              ? 'Approving sends the transfer automatically.'
              : 'After approving, send the money from the Flutterwave dashboard and record it below.'}
          </span>
        </div>
      ) : null}

      {actions.canMarkPaid ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (reference.trim().length >= 2) {
              markPaid.mutate({ id, reference: reference.trim() })
            }
          }}
        >
          <label className="text-foreground text-sm font-semibold">
            Paid by hand? Record the reference
          </label>
          <div className="flex flex-col gap-2 md:flex-row">
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Flutterwave dashboard or bank reference"
              disabled={markPaid.isPending}
            />
            <Button
              type="submit"
              variant="outline"
              disabled={reference.trim().length < 2 || markPaid.isPending}
            >
              {markPaid.isPending ? 'Recording…' : `Mark ${amount} as paid`}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Only once the money has actually left. The organizer is emailed the
            reference.
          </p>
        </form>
      ) : null}

      {actions.canReject ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (reason.trim().length >= 3) reject.mutate({ id, reason: reason.trim() })
          }}
        >
          <label className="text-foreground text-sm font-semibold">Reject</label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why — the organizer sees this. e.g. The account name does not match your business; update your bank account and ask again."
            disabled={reject.isPending}
          />
          <div>
            <Button
              type="submit"
              variant="destructive"
              disabled={reason.trim().length < 3 || reject.isPending}
            >
              {reject.isPending ? 'Rejecting…' : 'Reject request'}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  )
}

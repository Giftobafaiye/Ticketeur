'use client'

import { useState } from 'react'
import { notFound } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { cn } from '@ticketur/ui/lib/utils'
import { Button } from '@ticketur/ui/components/button'
import { Input } from '@ticketur/ui/components/input'
import { Switch } from '@ticketur/ui/components/switch'
import { Textarea } from '@ticketur/ui/components/textarea'
import {
  NativeSelect,
  NativeSelectOption,
} from '@ticketur/ui/components/native-select'
import { formatNaira } from '@ticketur/db/payouts/format'

import { useTRPC } from '@/lib/trpc'
import { formatShortDate } from '@/lib/date'
import { BackButton } from '@/components/dashboard/users/back-button'
import { PayoutStatusBadge } from '@/components/dashboard/payouts/status'

// One organizer's money, line by line: what each event earned and when it
// releases, every adjustment, every payout, every bank account. The place an
// admin records money already paid outside the platform, before that
// organizer can withdraw it a second time.

export function OrganizerPayoutsDetail({
  organizerId,
}: {
  organizerId: string
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useQuery(
    trpc.admin.payouts.organizer.queryOptions({ organizerId })
  )

  function refresh() {
    void queryClient.invalidateQueries({
      queryKey: trpc.admin.payouts.organizer.queryKey({ organizerId }),
    })
    void queryClient.invalidateQueries({
      queryKey: trpc.admin.payouts.balances.queryKey(),
    })
    void queryClient.invalidateQueries({
      queryKey: trpc.admin.payouts.stats.queryKey(),
    })
  }

  const early = useMutation(
    trpc.admin.payouts.setEarlyRelease.mutationOptions({
      onSuccess: (_res, vars) => {
        toast.success(
          vars.enabled
            ? 'Earnings now release as soon as they are paid'
            : 'Earnings release the day after each event again'
        )
        refresh()
      },
      onError: (err) =>
        toast.error('Could not change early release', {
          description: err.message,
        }),
    })
  )

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

  const { summary } = data
  const title =
    data.profile?.orgName || data.profile?.name || 'Deleted account'

  return (
    <>
      <BackButton label="Back" />

      <header className="flex flex-col gap-1.5">
        <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight md:text-[28px]">
          {title}
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          {data.profile
            ? `${data.profile.name} · ${data.profile.email} · ${data.profile.role}`
            : 'This account was deleted. Its payout history is kept.'}
        </p>
        {data.isSelf ? (
          <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
            This is your own account. You cannot adjust it or release it early.
          </p>
        ) : null}
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Figure label="Earned" minor={summary.earnedMinor} />
        <Figure label="On hold" minor={summary.heldMinor} />
        <Figure label="Adjustments" minor={summary.adjustmentsMinor} />
        <Figure label="In progress" minor={summary.inProgressMinor} />
        <Figure label="Paid out" minor={summary.paidOutMinor} />
        <Figure
          label="Available"
          minor={summary.availableMinor}
          tone={summary.availableMinor < 0 ? 'bad' : 'good'}
        />
      </section>

      <section className="border-border/60 bg-background flex items-start justify-between gap-4 rounded-2xl border p-5">
        <div className="flex flex-col gap-1">
          <span className="text-foreground font-semibold">Early release</span>
          <span className="text-muted-foreground text-sm">
            Normally an event&apos;s money can be withdrawn the day after it
            ends, so a cancelled event can still be refunded. Turn this on for
            an organizer you trust to let them withdraw as soon as buyers pay.
          </span>
        </div>
        <Switch
          checked={summary.earlyRelease}
          disabled={data.isSelf || early.isPending}
          onCheckedChange={(checked) =>
            early.mutate({ organizerId, enabled: checked })
          }
          aria-label="Early release"
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-foreground text-lg font-semibold">
          Earnings by event
        </h2>
        {summary.events.length === 0 ? (
          <p className="text-muted-foreground text-sm">No paid orders.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {summary.events.map((e) => (
              <li
                key={e.eventId}
                className="border-border/60 bg-background flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm"
              >
                <div className="flex flex-col">
                  <span className="text-foreground font-semibold">{e.title}</span>
                  <span className="text-muted-foreground text-xs">
                    {e.paidOrders} paid orders ·{' '}
                    {e.lastDay ? `ends ${formatShortDate(e.lastDay)}` : 'no date'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-foreground font-semibold">
                    {formatNaira(e.earnedMinor)}
                  </span>
                  <span
                    className={cn(
                      'rounded-md px-2 py-0.5 text-xs font-semibold',
                      e.released
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                    )}
                  >
                    {e.released
                      ? 'Released'
                      : e.releaseDate
                        ? `Releases ${formatShortDate(e.releaseDate)}`
                        : 'Held: no date'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AdjustmentsSection
        organizerId={organizerId}
        disabled={data.isSelf}
        adjustments={data.adjustments}
        onChanged={refresh}
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-foreground text-lg font-semibold">
          Withdrawals
        </h2>
        {data.payouts.length === 0 ? (
          <p className="text-muted-foreground text-sm">None yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.payouts.map((p) => (
              <li
                key={p.id}
                className="border-border/60 bg-background flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm"
              >
                <div className="flex flex-col">
                  <span className="text-foreground font-semibold">
                    {formatNaira(p.amountMinor)}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {p.bankName} {p.accountNumber} · requested{' '}
                    {formatShortDate(p.requestedAt)}
                    {p.paidAt ? ` · paid ${formatShortDate(p.paidAt)}` : ''}
                    {p.method ? ` · ${p.method === 'manual' ? 'by hand' : 'transfer'}` : ''}
                  </span>
                </div>
                <PayoutStatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-foreground text-lg font-semibold">
          Bank accounts
        </h2>
        {data.accounts.length === 0 ? (
          <p className="text-muted-foreground text-sm">None added.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.accounts.map((a) => (
              <li
                key={a.id}
                className="border-border/60 bg-background flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm"
              >
                <div className="flex flex-col">
                  <span className="text-foreground font-semibold">
                    {a.accountName}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {a.bankName} {a.accountNumber} · added{' '}
                    {formatShortDate(a.createdAt)}
                    {a.retiredAt ? ` · replaced ${formatShortDate(a.retiredAt)}` : ''}
                  </span>
                </div>
                <span
                  className={cn(
                    'rounded-md px-2 py-0.5 text-xs font-semibold',
                    a.status === 'active'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {a.status === 'active' ? 'Active' : 'Replaced'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function Figure({
  label,
  minor,
  tone,
}: {
  label: string
  minor: number
  tone?: 'good' | 'bad'
}) {
  return (
    <div className="border-border/60 bg-background flex flex-col gap-1 rounded-2xl border p-4">
      <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
        {label}
      </span>
      <span
        className={cn(
          'font-heading text-lg font-bold',
          tone === 'good' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'bad' && 'text-rose-600 dark:text-rose-400',
          !tone && 'text-foreground'
        )}
      >
        {formatNaira(minor)}
      </span>
    </div>
  )
}

type Adjustment = {
  id: string
  amountMinor: number
  kind: 'paid_outside' | 'correction'
  reason: string
  createdByName: string
  createdAt: Date
}

function AdjustmentsSection({
  organizerId,
  disabled,
  adjustments,
  onChanged,
}: {
  organizerId: string
  disabled: boolean
  adjustments: Adjustment[]
  onChanged: () => void
}) {
  const trpc = useTRPC()
  const [kind, setKind] = useState<'paid_outside' | 'correction'>('paid_outside')
  const [direction, setDirection] = useState<'credit' | 'debit'>('debit')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)

  const add = useMutation(
    trpc.admin.payouts.addAdjustment.mutationOptions({
      onSuccess: () => {
        toast.success('Adjustment recorded')
        setAmount('')
        setReason('')
        setConfirming(false)
        onChanged()
      },
      onError: (err) => {
        setConfirming(false)
        toast.error('Could not record the adjustment', {
          description: err.message,
        })
      },
    })
  )

  const naira = Number(amount)
  const amountMinor = Number.isFinite(naira) ? Math.round(naira * 100) : 0
  const effectiveDirection = kind === 'paid_outside' ? 'debit' : direction
  const valid = amountMinor > 0 && reason.trim().length >= 3

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) {
      toast.error('Enter an amount and a reason.')
      return
    }
    if (!confirming) {
      setConfirming(true)
      return
    }
    add.mutate({
      organizerId,
      kind,
      direction: effectiveDirection,
      amountMinor,
      reason: reason.trim(),
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-foreground text-lg font-semibold">
          Adjustments
        </h2>
        <p className="text-muted-foreground text-sm">
          Record money this organizer was already paid outside Ticketeur, or
          correct their balance. Adjustments cannot be edited or deleted —
          correct a mistake with another one.
        </p>
      </div>

      {adjustments.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {adjustments.map((a) => (
            <li
              key={a.id}
              className="border-border/60 bg-background flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm"
            >
              <div className="flex flex-col">
                <span className="text-foreground">{a.reason}</span>
                <span className="text-muted-foreground text-xs">
                  {a.kind === 'paid_outside' ? 'Paid outside Ticketeur' : 'Correction'}{' '}
                  · {a.createdByName || 'admin'} · {formatShortDate(a.createdAt)}
                </span>
              </div>
              <span
                className={cn(
                  'font-semibold',
                  a.amountMinor < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                )}
              >
                {formatNaira(a.amountMinor)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {disabled ? null : (
        <form
          onSubmit={onSubmit}
          className="border-border/60 bg-background grid grid-cols-1 gap-4 rounded-2xl border p-5 md:grid-cols-3"
        >
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Type
            <NativeSelect
              className="w-full"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as typeof kind)
                setConfirming(false)
              }}
              disabled={add.isPending}
            >
              <NativeSelectOption value="paid_outside">
                Already paid outside Ticketeur
              </NativeSelectOption>
              <NativeSelectOption value="correction">Correction</NativeSelectOption>
            </NativeSelect>
          </label>
          {kind === 'correction' ? (
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Direction
              <NativeSelect
                className="w-full"
                value={direction}
                onChange={(e) => {
                  setDirection(e.target.value as typeof direction)
                  setConfirming(false)
                }}
                disabled={add.isPending}
              >
                <NativeSelectOption value="debit">
                  Take off their balance
                </NativeSelectOption>
                <NativeSelectOption value="credit">
                  Add to their balance
                </NativeSelectOption>
              </NativeSelect>
            </label>
          ) : (
            <div />
          )}
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Amount (₦)
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                setConfirming(false)
              }}
              placeholder="124000"
              disabled={add.isPending}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold md:col-span-3">
            Reason
            <Textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                setConfirming(false)
              }}
              placeholder="e.g. Paid by bank transfer on 30 July for Voices Stage Play, GTB ref 123456"
              disabled={add.isPending}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3 md:col-span-3">
            <Button type="submit" disabled={add.isPending || !valid}>
              {add.isPending
                ? 'Recording…'
                : confirming
                  ? `Confirm ${effectiveDirection === 'debit' ? '−' : '+'}${formatNaira(amountMinor)}`
                  : 'Record adjustment'}
            </Button>
            {confirming ? (
              <span className="text-muted-foreground text-sm">
                This {effectiveDirection === 'debit' ? 'reduces' : 'increases'}{' '}
                the balance by {formatNaira(amountMinor)} and cannot be undone
                except by another adjustment.
              </span>
            ) : null}
          </div>
        </form>
      )}
    </section>
  )
}

'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@ticketur/ui/components/button'
import { Input } from '@ticketur/ui/components/input'
import { Switch } from '@ticketur/ui/components/switch'
import { Field, FieldLabel } from '@ticketur/ui/components/field'

import { useTRPC } from '@/lib/trpc'
import { authClient } from '@/lib/auth-client'

const MIN_PASSWORD = 8

export function AccountSettingsContent() {
  const trpc = useTRPC()
  const { data: me, isLoading } = useQuery(
    trpc.account.profile.get.queryOptions()
  )

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8 md:gap-8 md:px-10 md:py-12">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight md:text-[32px]">
          Settings
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Email preferences and how you sign in.
        </p>
      </header>

      {isLoading || !me ? (
        <>
          <div className="bg-muted h-32 animate-pulse rounded-2xl" />
          <div className="bg-muted h-64 animate-pulse rounded-2xl" />
        </>
      ) : (
        <>
          <MarketingCard
            optIn={me.marketingOptIn}
            changedAt={me.marketingConsentAt}
          />
          <PasswordCard hasPassword={me.hasPassword} />
          <SessionsCard />
        </>
      )}
    </section>
  )
}

function Card({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-5 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-foreground text-lg font-semibold">
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function MarketingCard({
  optIn,
  changedAt,
}: {
  optIn: boolean
  changedAt: Date | null
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const setOptIn = useMutation(
    trpc.account.profile.setMarketingOptIn.mutationOptions({
      onSuccess: (res) => {
        toast.success(
          res.optIn
            ? "You're subscribed to event news"
            : "You won't get marketing emails"
        )
        void queryClient.invalidateQueries({
          queryKey: trpc.account.profile.get.queryKey(),
        })
      },
      onError: (e) => toast.error('Could not save', { description: e.message }),
    })
  )

  return (
    <Card
      title="Email preferences"
      description="Tickets, receipts and sign-in codes are always sent. This is only about news and offers."
    >
      <label className="flex items-start justify-between gap-4">
        <span className="flex flex-col gap-0.5">
          <span className="text-foreground text-sm font-medium">
            Event news, offers and the newsletter
          </span>
          {changedAt ? (
            <span className="text-muted-foreground text-xs">
              {optIn ? 'Subscribed' : 'Unsubscribed'} on{' '}
              {format(new Date(changedAt), 'd MMM yyyy')}
            </span>
          ) : null}
        </span>
        <Switch
          checked={optIn}
          disabled={setOptIn.isPending}
          onCheckedChange={(v) => setOptIn.mutate({ optIn: v })}
          aria-label="Receive marketing emails"
        />
      </label>
    </Card>
  )
}

function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, start] = useTransition()

  if (!hasPassword) {
    return (
      <Card
        title="Password"
        description="You sign in with a social account, so there is no password to change."
      >
        <div>
          <Button variant="outline" asChild>
            <Link href="/forgot-password">Set a password</Link>
          </Button>
        </div>
      </Card>
    )
  }

  const mismatch = confirm.length > 0 && confirm !== next
  const tooShort = next.length > 0 && next.length < MIN_PASSWORD
  const canSubmit =
    current.length > 0 && next.length >= MIN_PASSWORD && next === confirm

  return (
    <Card title="Password">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!canSubmit) return
          start(async () => {
            const { error } = await authClient.changePassword({
              currentPassword: current,
              newPassword: next,
              // A changed password should lock out whoever knew the old one.
              revokeOtherSessions: true,
            })
            if (error) {
              toast.error('Could not change password', {
                description: error.message ?? 'Check your current password.',
              })
              return
            }
            setCurrent('')
            setNext('')
            setConfirm('')
            toast.success('Password changed', {
              description: 'Other devices have been signed out.',
            })
          })
        }}
      >
        <Field>
          <FieldLabel
            htmlFor="current-password"
            className="text-sm font-semibold"
          >
            Current password
          </FieldLabel>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field data-invalid={tooShort || undefined}>
          <FieldLabel htmlFor="new-password" className="text-sm font-semibold">
            New password
          </FieldLabel>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            aria-invalid={tooShort}
          />
          {tooShort ? (
            <span className="text-destructive text-xs">
              At least {MIN_PASSWORD} characters.
            </span>
          ) : null}
        </Field>
        <Field data-invalid={mismatch || undefined}>
          <FieldLabel
            htmlFor="confirm-password"
            className="text-sm font-semibold"
          >
            Confirm new password
          </FieldLabel>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={mismatch}
          />
          {mismatch ? (
            <span className="text-destructive text-xs">
              Passwords don&apos;t match.
            </span>
          ) : null}
        </Field>
        <div>
          <Button type="submit" disabled={!canSubmit || pending}>
            {pending ? 'Saving…' : 'Change password'}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function SessionsCard() {
  const [pending, start] = useTransition()
  return (
    <Card
      title="Signed-in devices"
      description="Lost a phone, or signed in on a shared computer? Sign out everywhere except here."
    >
      <div>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const { error } = await authClient.revokeOtherSessions()
              if (error) {
                toast.error('Could not sign out other devices', {
                  description: error.message ?? 'Please try again.',
                })
                return
              }
              toast.success('Signed out of every other device')
            })
          }
        >
          {pending ? 'Signing out…' : 'Sign out other devices'}
        </Button>
      </div>
    </Card>
  )
}

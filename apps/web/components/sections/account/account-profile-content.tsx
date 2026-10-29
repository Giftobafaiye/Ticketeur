'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowRight01Icon,
  DashboardSquare02Icon,
  File01Icon,
  Settings02Icon,
  Ticket01Icon,
} from '@hugeicons/core-free-icons'

import { Button } from '@ticketur/ui/components/button'
import { Input } from '@ticketur/ui/components/input'
import { Field, FieldLabel } from '@ticketur/ui/components/field'

import { useTRPC } from '@/lib/trpc'
import { getPostLoginPath } from '@/lib/post-login-redirect'

const ROLE_LABEL: Record<string, string> = {
  attendee: 'Attendee',
  organizer: 'Organizer',
  vendor: 'Vendor',
  admin: 'Admin',
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('') || '?'
  )
}

export function AccountProfileContent() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: me, isLoading } = useQuery(
    trpc.account.profile.get.queryOptions()
  )
  const [name, setName] = useState('')
  useEffect(() => {
    if (me) setName(me.name)
  }, [me])

  const updateName = useMutation(
    trpc.account.profile.updateName.mutationOptions({
      onSuccess: () => {
        toast.success('Profile updated')
        void queryClient.invalidateQueries({
          queryKey: trpc.account.profile.get.queryKey(),
        })
      },
      onError: (e) => toast.error('Could not save', { description: e.message }),
    })
  )

  if (isLoading || !me) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8 md:px-10 md:py-12">
        <div className="bg-muted h-40 animate-pulse rounded-2xl" />
        <div className="bg-muted h-56 animate-pulse rounded-2xl" />
      </section>
    )
  }

  const role = me.role ?? 'attendee'
  const dashboardHref = getPostLoginPath(role)
  const trimmed = name.trim()
  const dirty = trimmed.length > 0 && trimmed !== me.name

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8 md:gap-8 md:px-10 md:py-12">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight md:text-[32px]">
          Profile
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Your Ticketeur account.
        </p>
      </header>

      <div className="border-border bg-card flex flex-col gap-6 rounded-2xl border p-5 md:p-6">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 text-primary flex size-16 shrink-0 items-center justify-center rounded-full text-xl font-semibold">
            {initials(me.name)}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-foreground truncate text-lg font-semibold">
              {me.name}
            </span>
            <span className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
              <span className="bg-muted rounded px-2 py-0.5 text-xs font-semibold tracking-wider uppercase">
                {ROLE_LABEL[role] ?? role}
              </span>
              Member since {format(new Date(me.createdAt), 'MMMM yyyy')}
            </span>
          </div>
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (dirty) updateName.mutate({ name: trimmed })
          }}
        >
          <Field>
            <FieldLabel htmlFor="name" className="text-sm font-semibold">
              Full name
            </FieldLabel>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              autoComplete="name"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="email" className="text-sm font-semibold">
              Email address
            </FieldLabel>
            <Input id="email" value={me.email} disabled readOnly />
            <span className="text-muted-foreground text-xs">
              Your tickets and receipts are sent here. Contact support to change
              it.
            </span>
          </Field>
          <div>
            <Button type="submit" disabled={!dirty || updateName.isPending}>
              {updateName.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>

      <nav
        aria-label="Account"
        className="border-border bg-card divide-border flex flex-col divide-y rounded-2xl border"
      >
        {dashboardHref !== '/' ? (
          <AccountLink
            href={dashboardHref}
            icon={DashboardSquare02Icon}
            label="Dashboard"
          />
        ) : null}
        <AccountLink
          href="/account/tickets"
          icon={Ticket01Icon}
          label="My tickets"
        />
        <AccountLink
          href="/account/applications"
          icon={File01Icon}
          label="My applications"
        />
        <AccountLink
          href="/account/settings"
          icon={Settings02Icon}
          label="Settings"
        />
      </nav>
    </section>
  )
}

function AccountLink({
  href,
  icon,
  label,
}: {
  href: string
  icon: Parameters<typeof HugeiconsIcon>[0]['icon']
  label: string
}) {
  return (
    <Link
      href={href}
      className="hover:bg-muted/50 flex items-center gap-3 px-5 py-4 text-sm font-medium transition-colors first:rounded-t-2xl last:rounded-b-2xl"
    >
      <HugeiconsIcon
        icon={icon}
        className="text-muted-foreground size-5"
        strokeWidth={1.6}
      />
      <span className="text-foreground flex-1">{label}</span>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        className="text-muted-foreground size-4"
        strokeWidth={2}
      />
    </Link>
  )
}

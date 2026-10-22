'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, Search01Icon } from '@hugeicons/core-free-icons'

import { cn } from '@ticketur/ui/lib/utils'
import { Button } from '@ticketur/ui/components/button'
import { Input } from '@ticketur/ui/components/input'
import {
  NativeSelect,
  NativeSelectOption,
} from '@ticketur/ui/components/native-select'

import { useTRPC } from '@/lib/trpc'
import { useActionDialog } from '@/components/dashboard/action-dialog/store'

// tiptap is heavy and this is a low-traffic internal page, so the editor loads
// on demand.
const MarkdownEditor = dynamic(
  () =>
    import('@ticketur/ui/components/markdown-editor').then(
      (m) => m.MarkdownEditor
    ),
  {
    ssr: false,
    loading: () => (
      <div className="border-input bg-muted/30 h-48 w-full animate-pulse rounded-md border" />
    ),
  }
)

type Mode = 'everyone' | 'role' | 'users' | 'event'
type Role = 'attendee' | 'organizer' | 'vendor'
type PickedUser = { id: string; name: string; email: string }
type PickedEvent = { id: string; title: string; buyers: number }

const MODES: { value: Mode; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'role', label: 'By role' },
  { value: 'users', label: 'Specific users' },
  // The audience a venue change needs: everyone holding a paid place at one
  // event, guest buyers included.
  { value: 'event', label: "One event's attendees" },
]

export function EmailComposeContent() {
  const trpc = useTRPC()
  const dialog = useActionDialog()

  const [mode, setMode] = useState<Mode>('everyone')
  const [role, setRole] = useState<Role>('attendee')
  const [selected, setSelected] = useState<PickedUser[]>([])
  const [event, setEvent] = useState<PickedEvent | null>(null)
  const [eventSearch, setEventSearch] = useState('')
  const [search, setSearch] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const audience =
    mode === 'everyone'
      ? ({ type: 'everyone' } as const)
      : mode === 'role'
        ? ({ type: 'role', role } as const)
        : mode === 'event'
          ? ({ type: 'event', eventId: event?.id ?? '' } as const)
          : ({ type: 'users', userIds: selected.map((s) => s.id) } as const)

  // Headcount for everyone/role; for a hand-picked set it's just the chips.
  const countQuery = useQuery(
    trpc.admin.emails.recipientCount.queryOptions(
      mode === 'role'
        ? { type: 'role', role }
        : mode === 'event'
          ? ({ type: 'event', eventId: event?.id ?? '' } as const)
          : ({ type: 'everyone' } as const),
      { enabled: mode !== 'users' && (mode !== 'event' || event !== null) }
    )
  )
  const recipientCount =
    mode === 'users'
      ? selected.length
      : mode === 'event' && event === null
        ? null
        : (countQuery.data?.count ?? null)

  const eventQuery = useQuery(
    trpc.admin.emails.searchEvents.queryOptions(
      { q: eventSearch.trim() },
      { enabled: mode === 'event' }
    )
  )

  const searchQuery = useQuery(
    trpc.admin.emails.searchRecipients.queryOptions(
      { q: search.trim() },
      { enabled: mode === 'users' }
    )
  )

  const send = useMutation(
    trpc.admin.emails.send.mutationOptions({
      onSuccess: ({ recipients }) => {
        toast.success('Email queued', {
          description: `Sending to ${recipients} ${recipients === 1 ? 'person' : 'people'}.`,
        })
        setSubject('')
        setBody('')
        setSelected([])
        setSearch('')
      },
      onError: (e) => toast.error('Could not send', { description: e.message }),
    })
  )

  function addUser(u: PickedUser) {
    setSelected((prev) =>
      prev.some((s) => s.id === u.id) ? prev : [...prev, u]
    )
    setSearch('')
  }
  function removeUser(id: string) {
    setSelected((prev) => prev.filter((s) => s.id !== id))
  }

  async function onSend() {
    if (!subject.trim()) return toast.error('Add a subject.')
    if (!body.trim()) return toast.error('Write a message.')
    if (mode === 'event' && !event)
      return toast.error('Pick the event these people are coming to.')
    if (mode === 'users' && selected.length === 0)
      return toast.error('Pick at least one user.')
    const count = recipientCount ?? 0
    if (count === 0) return toast.error('That selection has no recipients.')

    const ok = await dialog.confirm({
      title: `Send to ${count} ${count === 1 ? 'person' : 'people'}?`,
      description: 'This sends a real email right away and can’t be undone.',
      confirmLabel: 'Send email',
      tone: 'danger',
    })
    if (ok) send.mutate({ audience, subject: subject.trim(), body })
  }

  const selectedIds = new Set(selected.map((s) => s.id))

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {/* Recipients */}
      <section className="border-border/60 bg-background flex flex-col gap-4 rounded-2xl border p-5 md:p-6">
        <h2 className="font-heading text-foreground text-base font-bold">
          Recipients
        </h2>

        <div className="bg-muted/50 flex w-fit items-center gap-1 rounded-lg p-1">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-semibold transition-colors',
                mode === m.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'role' ? (
          <NativeSelect
            className="w-full max-w-xs"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <NativeSelectOption value="attendee">Attendees</NativeSelectOption>
            <NativeSelectOption value="organizer">
              Organizers
            </NativeSelectOption>
            <NativeSelectOption value="vendor">Vendors</NativeSelectOption>
          </NativeSelect>
        ) : null}

        {mode === 'event' ? (
          <div className="flex flex-col gap-3">
            {event ? (
              <div className="border-border bg-muted/40 flex items-center justify-between gap-4 rounded-xl border p-4">
                <div className="flex min-w-0 flex-col">
                  <span className="text-foreground truncate text-sm font-semibold">
                    {event.title}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {event.buyers}{' '}
                    {event.buyers === 1 ? 'person has' : 'people have'} paid to
                    attend
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEvent(null)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Search events that have sold…"
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                />
                <ul className="border-border max-h-64 divide-y overflow-auto rounded-xl border">
                  {(eventQuery.data ?? []).map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setEvent({
                            id: e.id,
                            title: e.title,
                            buyers: e.buyers,
                          })
                        }
                        className="hover:bg-muted flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors"
                      >
                        <span className="text-foreground text-sm font-medium">
                          {e.title}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {e.eventDate ?? 'Date TBD'} · {e.location} ·{' '}
                          {e.buyers} paid
                        </span>
                      </button>
                    </li>
                  ))}
                  {eventQuery.data?.length === 0 ? (
                    <li className="text-muted-foreground px-4 py-3 text-sm">
                      No event with paid orders matches that.
                    </li>
                  ) : null}
                </ul>
              </>
            )}
          </div>
        ) : null}

        {mode === 'users' ? (
          <div className="flex flex-col gap-3">
            {selected.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selected.map((u) => (
                  <span
                    key={u.id}
                    className="bg-primary/10 text-foreground inline-flex items-center gap-1.5 rounded-full py-1 pr-1.5 pl-3 text-sm"
                  >
                    <span className="font-medium">{u.name || u.email}</span>
                    <button
                      type="button"
                      onClick={() => removeUser(u.id)}
                      aria-label={`Remove ${u.name || u.email}`}
                      className="hover:bg-primary/20 flex size-5 items-center justify-center rounded-full transition-colors"
                    >
                      <HugeiconsIcon
                        icon={Cancel01Icon}
                        className="size-3.5"
                        strokeWidth={2}
                      />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <div className="relative">
              <HugeiconsIcon
                icon={Search01Icon}
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                strokeWidth={1.8}
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users by name or email"
                className="pl-9"
              />
            </div>

            {search.trim().length > 0 ? (
              <div className="border-border/60 max-h-64 overflow-y-auto rounded-lg border">
                {searchQuery.isLoading ? (
                  <p className="text-muted-foreground p-4 text-sm">
                    Searching…
                  </p>
                ) : (searchQuery.data ?? []).length === 0 ? (
                  <p className="text-muted-foreground p-4 text-sm">
                    No matching users.
                  </p>
                ) : (
                  (searchQuery.data ?? []).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() =>
                        addUser({ id: u.id, name: u.name, email: u.email })
                      }
                      disabled={selectedIds.has(u.id)}
                      className="hover:bg-muted/50 flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors disabled:opacity-40"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="text-foreground truncate text-sm font-medium">
                          {u.name || '—'}
                        </span>
                        <span className="text-muted-foreground truncate text-xs">
                          {u.email}
                        </span>
                      </span>
                      <span className="text-muted-foreground text-xs capitalize">
                        {u.role ?? 'attendee'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <p className="text-muted-foreground text-sm">
          {recipientCount === null ? (
            'Counting recipients…'
          ) : (
            <>
              This message will reach{' '}
              <span className="text-foreground font-semibold">
                {recipientCount}
              </span>{' '}
              {recipientCount === 1 ? 'person' : 'people'}.
            </>
          )}
        </p>
      </section>

      {/* Message */}
      <section className="border-border/60 bg-background flex flex-col gap-4 rounded-2xl border p-5 md:p-6">
        <h2 className="font-heading text-foreground text-base font-bold">
          Message
        </h2>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="broadcast-subject"
            className="text-foreground text-sm font-semibold"
          >
            Subject
          </label>
          <Input
            id="broadcast-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="What's this email about?"
            maxLength={200}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-foreground text-sm font-semibold">Body</span>
          <MarkdownEditor
            value={body}
            onChange={setBody}
            placeholder="Write your message… the Ticketeur header and footer are added for you."
            ariaLabel="Email body"
          />
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        <span className="text-muted-foreground text-xs">
          Sent from {`Ticketeur <noreply@useticketeur.com>`}
        </span>
        <Button onClick={onSend} disabled={send.isPending}>
          {send.isPending ? 'Sending…' : 'Send email'}
        </Button>
      </div>
    </div>
  )
}

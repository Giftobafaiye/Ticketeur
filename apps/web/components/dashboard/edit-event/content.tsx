'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Button } from '@ticketur/ui/components/button'

import { useTRPC } from '@/lib/trpc'
import { type CreateEventValues } from '@/lib/create-event-schema'

import { FormView } from '@/components/dashboard/create-event/form-view'

// Statuses an organizer can still edit. Archived/suspended events are frozen
// (the server enforces this too).
const EDITABLE_STATUSES = new Set(['draft', 'in-review', 'upcoming'])

export function EditEventContent({ id }: { id: string }) {
  const router = useRouter()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery(
    trpc.org.events.byId.queryOptions({ id })
  )

  const update = useMutation(
    trpc.org.events.update.mutationOptions({
      onSuccess: (res) => {
        queryClient.invalidateQueries({
          queryKey: trpc.org.events.byId.queryKey({ id }),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.org.events.list.queryKey(),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.org.dashboard.stats.queryKey(),
        })
        if (res.pending) {
          toast.success('Changes submitted for approval', {
            description:
              'Your event stays live as it is until an admin approves the changes.',
          })
        } else {
          toast.success('Changes saved')
        }
        router.push(`/org/events/${id}`)
      },
      onError: (e) =>
        toast.error('Could not save changes', { description: e.message }),
    })
  )

  // Map the loaded event onto the shared create/edit form shape. Prices are
  // stored in minor units (kobo); the form works in major units (₦).
  const initialValues = useMemo<CreateEventValues | null>(() => {
    if (!data) return null
    const { event, tiers, vendors, externalInvites } = data
    const soldById = new Map(tiers.map((t) => [t.id, t.sold]))
    const assignedVendorIds = vendors.map((v) => v.vendor.id)
    const invites = externalInvites.map((inv) => ({
      businessName: inv.businessName,
      contactName: inv.contactName,
      email: inv.email,
      phone: inv.phone,
    }))

    // If a pending edit exists, prefill from it so the organizer sees and can
    // adjust what's queued; otherwise prefill from the live event. `sold` is
    // read from the live tier so the form's capacity guard still works.
    const pc = event.pendingChanges
    if (pc) {
      return {
        title: pc.title,
        description: pc.description,
        date: pc.date ?? '',
        endDate: pc.endDate ?? null,
        time: pc.time,
        location: pc.location,
        features: pc.features,
        tiers: pc.tiers.map((t) => ({
          id: t.id,
          sold: t.id ? (soldById.get(t.id) ?? 0) : 0,
          name: t.name,
          quantity: t.quantity,
          price: t.priceMinor / 100,
        })),
        assignedVendorIds,
        externalInvites: invites,
      }
    }

    return {
      title: event.title,
      description: event.description,
      // A postponed/TBD event has no date; the edit form needs a string, so
      // show it empty (the organizer picks a date to re-announce it).
      date: event.eventDate ?? '',
      endDate: event.endDate,
      time: event.eventTime,
      location: event.location,
      features: event.features,
      tiers: tiers.map((t) => ({
        id: t.id,
        sold: t.sold,
        name: t.name,
        quantity: t.quantity,
        price: t.priceMinor / 100,
      })),
      assignedVendorIds,
      externalInvites: invites,
    }
  }, [data])

  if (isLoading || !data || !initialValues) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">
          {isLoading ? 'Loading event…' : 'Event not found.'}
        </p>
      </div>
    )
  }

  const status = data.event.status
  if (!EDITABLE_STATUSES.has(status)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-muted-foreground text-sm">
          This event can no longer be edited.
        </p>
        <Button asChild variant="outline">
          <Link href={`/org/events/${id}`}>Back to event</Link>
        </Button>
      </div>
    )
  }

  const isLive = status === 'upcoming'
  const pending = Boolean(data.event.pendingChanges)
  const initialBanner =
    data.event.pendingChanges?.bannerUrl ?? data.event.bannerUrl
  const primaryLabel = update.isPending
    ? isLive
      ? 'Submitting…'
      : 'Saving…'
    : isLive
      ? pending
        ? 'Update pending changes'
        : 'Submit for approval'
      : 'Save Changes'

  return (
    // min-h-0 + flex-1 keep the flex-height chain intact so the form's own
    // `overflow-y-auto` region (FormView) actually scrolls inside the dashboard
    // shell (whose <main> is overflow-hidden). Without this the tall edit form
    // overflows and gets clipped — you can't scroll to the fields below.
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      {isLive ? (
        <div className="border-primary/25 bg-primary/5 text-foreground/90 shrink-0 rounded-xl border px-4 py-3 text-sm">
          {pending
            ? 'You have changes awaiting admin approval. Your event stays live with its current details — editing here updates what’s pending.'
            : 'This event is live. Changes you submit go to an admin for approval before they appear on the website; the current version stays up until then.'}
        </div>
      ) : null}
      <EditForm
        id={id}
        initialValues={initialValues}
        initialBanner={initialBanner}
        submitting={update.isPending}
        primaryLabel={primaryLabel}
        onSave={update.mutate}
      />
    </div>
  )
}

function EditForm({
  id,
  initialValues,
  initialBanner,
  submitting,
  primaryLabel,
  onSave,
}: {
  id: string
  initialValues: CreateEventValues
  initialBanner: string | null
  submitting: boolean
  primaryLabel: string
  onSave: (input: {
    id: string
    title: string
    description: string
    date: string
    endDate: string | null
    time: string
    location: string
    bannerUrl: string | null
    features: string[]
    tiers: {
      id?: string
      name: string
      quantity: number
      priceMinor: number
    }[]
  }) => void
}) {
  const [values, setValues] = useState<CreateEventValues>(initialValues)
  const [banner, setBanner] = useState<string | null>(initialBanner)
  // onChange fires synchronously right before onPreview inside the form's
  // submit handler, so this ref always holds the freshly validated values.
  const latest = useRef<CreateEventValues>(initialValues)

  function handleChange(next: CreateEventValues) {
    latest.current = next
    setValues(next)
  }

  function handleSave() {
    const v = latest.current
    onSave({
      id,
      title: v.title,
      description: v.description,
      date: v.date,
      endDate: v.endDate,
      time: v.time,
      location: v.location,
      bannerUrl: banner,
      features: v.features,
      tiers: v.tiers.map((t) => ({
        id: t.id,
        name: t.name,
        quantity: t.quantity,
        // Form prices are in major units (₦); convert to minor (kobo)
        priceMinor: Math.round(t.price * 100),
      })),
    })
  }

  return (
    <FormView
      values={values}
      onChange={handleChange}
      banner={banner}
      onBannerChange={setBanner}
      onPreview={handleSave}
      onSaveDraft={() => {}}
      heading="Edit Event"
      subheading="Update your event details and ticketing."
      primaryLabel={primaryLabel}
      secondaryLabel={null}
      showVendors={false}
      submitting={submitting}
    />
  )
}

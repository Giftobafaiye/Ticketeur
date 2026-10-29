'use client'

import { notFound } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { useTRPC } from '@/lib/trpc'
import { iconForFeature } from '@/lib/feature-icons'
import {
  EVENT_CARD_STATUS_LABEL,
  eventCardStatus,
  formatNaira,
  formatEventDate,
} from '@/lib/event-display'

import { EventHero } from '@/components/sections/event-detail/event-hero'
import { EventTabs } from '@/components/sections/event-detail/event-tabs'
import { EventContests } from '@/components/sections/event-detail/event-contests'
import { EventForms } from '@/components/sections/event-detail/event-forms'
import { SimilarEvents } from '@/components/sections/event-detail/similar-events'
import { EventDetailSkeleton } from '@/components/sections/event-detail/event-detail-skeleton'
import { DetailsTab } from '@/components/sections/event-detail/details-tab'
import type { EventVendor } from '@/components/sections/event-detail/vendors-tab'
import type { EventDetailData } from '@/components/sections/event-detail/types'

const EVENT_PLACEHOLDER = '/hero-bg.png'

export function EventDetailContent({ slug }: { slug: string }) {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(
    trpc.public.events.bySlug.queryOptions({ slug })
  )

  if (isLoading) {
    return <EventDetailSkeleton />
  }
  if (!data) {
    notFound()
  }

  const { event, minPriceMinor, hasEnded: ended } = data
  const soldOut =
    data.tiers.length > 0 && data.tiers.every((t) => t.sold >= t.quantity)
  const status = eventCardStatus({
    eventDate: event.eventDate,
    endDate: event.endDate,
    soldOut,
    ended,
  })

  const detail: EventDetailData = {
    id: event.id,
    slug: event.slug,
    title: event.title,
    status: ended
      ? 'Past event'
      : [EVENT_CARD_STATUS_LABEL[status], event.category]
          .filter(Boolean)
          .join(' · '),
    date: formatEventDate(event.eventDate, event.endDate),
    time: event.eventTime,
    location: event.location,
    imageUrl: event.bannerUrl ?? EVENT_PLACEHOLDER,
    description: event.description ? [event.description] : [],
    features: event.features.map((label) => ({
      icon: iconForFeature(label),
      label,
    })),
    price: minPriceMinor > 0 ? formatNaira(minPriceMinor) : 'Free',
    ended,
    soldOut,
  }

  const vendors: EventVendor[] = data.vendors.map((v) => ({
    id: v.id,
    vendorId: v.vendorId,
    businessName: v.businessName,
    businessCategory: v.businessCategory,
    businessDescription: v.businessDescription,
    tagline: v.tagline,
    image: v.image,
  }))

  return (
    <>
      <EventHero event={detail} />
      {ended ? (
        // A finished event is a glimpse of what was hosted — what it was and
        // what it offered — not the full page: nothing to buy, apply to or
        // browse vendors for. Its contests stay, for their results.
        <>
          <EventContests slug={slug} />
          <PastEventGlimpse event={detail} />
        </>
      ) : (
        <>
          {/* Renders nothing unless this event has a contest the public may
              see. Its own query, not a field on bySlug: the event read is the
              hottest on the platform and most events have no contest at all. */}
          <EventForms slug={slug} />
          <EventContests slug={slug} />
          <EventTabs event={detail} vendors={vendors} />
        </>
      )}
      <SimilarEvents eventId={event.id} />
    </>
  )
}

function PastEventGlimpse({ event }: { event: EventDetailData }) {
  return (
    <section aria-label="About this event" className="w-full px-5 md:px-10">
      <div className="mx-auto max-w-[1440px] pt-10 pb-6 md:pt-16 md:pb-10">
        <p className="border-border bg-muted/40 text-muted-foreground mb-8 rounded-xl border px-4 py-3 text-sm">
          This event has finished. Here is what it was about — browse upcoming
          events below for what&apos;s next.
        </p>
        <DetailsTab event={event} />
      </div>
    </section>
  )
}

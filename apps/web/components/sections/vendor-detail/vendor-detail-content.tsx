'use client'

import { useEffect } from 'react'
import { notFound } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'

import { useTRPC } from '@/lib/trpc'
import type { VendorRecord } from '@/lib/vendors'
import { formatEventDateRange } from '@/lib/date'

import { VendorHero } from '@/components/sections/vendor-detail/vendor-hero'
import { VendorProfileTabs } from '@/components/sections/vendor-detail/vendor-profile-tabs'
import type { VendorEventCard } from '@/components/sections/vendor-detail/vendor-events-tab'

const VENDOR_PLACEHOLDER = '/vendor-placeholder.png'
const BANNER_PLACEHOLDER =
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1600&q=80'

function toEventCard(ev: {
  id: string
  slug: string
  eventDate: string | null
  endDate: string | null
  location: string
  bannerUrl: string | null
  attendeeCount?: number
  title: string
}): VendorEventCard {
  return {
    id: ev.id,
    slug: ev.slug,
    tag: 'Event',
    date: formatEventDateRange(ev.eventDate, ev.endDate),
    title: ev.title,
    description: '',
    location: ev.location,
    attendees:
      ev.attendeeCount !== undefined && ev.attendeeCount > 0
        ? `${ev.attendeeCount.toLocaleString()} Attendees`
        : '',
    imageUrl: ev.bannerUrl ?? '/hero-bg.png',
  }
}

export function VendorDetailContent({ id }: { id: string }) {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(
    trpc.public.vendors.byId.queryOptions({ id })
  )

  const recordView = useMutation(
    trpc.public.vendors.recordView.mutationOptions()
  )

  // Count one profile view per browser session per vendor. Runs once the
  // vendor has loaded; the sessionStorage guard stops refreshes and query
  // refetches from re-counting the same visit.
  const vendorId = data?.id
  useEffect(() => {
    if (!vendorId) return
    const key = `vendor-view:${vendorId}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      // sessionStorage unavailable — fall through and record without dedupe.
    }
    recordView.mutate({ id: vendorId })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId])

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-360 items-center justify-center px-5 py-20 md:px-10 md:py-28">
        <p className="text-muted-foreground text-sm">Loading vendor…</p>
      </div>
    )
  }

  if (!data) {
    notFound()
  }

  // Pass the description as a single markdown string — VendorAbout renders
  // it through MarkdownView, so headings, lists, and paragraph breaks all
  // round-trip from the editor.
  const description = data.businessDescription ?? ''
  // Cast: VendorRecord.category is a closed literal union, but vendors can
  // self-select any category string in the profile form. Treating it as a
  // free string here is intentional.
  const vendor = {
    id: data.id,
    name: data.businessName ?? 'Vendor',
    category: data.businessCategory ?? 'Vendor',
    shortDescription: data.tagline ?? '',
    fullDescription: description ? [description] : [],
    imageUrl: data.image ?? VENDOR_PLACEHOLDER,
    location: data.location ?? 'Location not set',
    partnerSince: data.partnerSince,
    hostedEvents: data.hostedEvents,
    expertise: data.expertise ?? '—',
    focus: data.focus ?? '—',
    experience: data.experience ?? '—',
    certified: data.vendorApprovalStatus === 'approved',
  } as unknown as VendorRecord

  return (
    <>
      <VendorHero
        vendor={vendor}
        bannerUrl={data.bannerUrl ?? BANNER_PLACEHOLDER}
        avgRating={data.avgRating}
        reviewCount={data.reviewCount}
      />
      <VendorProfileTabs
        vendorId={id}
        vendor={vendor}
        contact={{
          phone: data.phone,
          email: data.email,
          location: data.location ?? 'Location not set',
          websiteUrl: data.websiteUrl,
          instagramUrl: data.instagramUrl,
          twitterUrl: data.twitterUrl,
          facebookUrl: data.facebookUrl,
          tiktokUrl: data.tiktokUrl,
          linkedinUrl: data.linkedinUrl,
          youtubeUrl: data.youtubeUrl,
          whatsapp: data.whatsapp,
        }}
        showcaseImages={data.showcaseImages}
        upcomingEvents={data.participatingEvents.map(toEventCard)}
        pastEvents={data.pastEvents.map(toEventCard)}
      />
    </>
  )
}

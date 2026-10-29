import type { Metadata } from 'next'

import { EventsPageHeader } from '@/components/sections/events/events-page-header'
import { FeaturedEvents } from '@/components/sections/events/featured-events'
import { EventsGridSection } from '@/components/sections/events/events-grid-section'
import { getServerTRPC, HydrateClient } from '@/lib/trpc-server'
import {
  DEFAULT_EVENTS_LIST_STATE,
  eventsListInput,
} from '@/lib/events-list-query'

export const metadata: Metadata = {
  title: 'Events',
  description:
    'Discover verified events from trusted organisers. Secure tickets, guaranteed entry.',
}

export default async function EventsPage() {
  const { trpc, queryClient } = await getServerTRPC()
  await Promise.all([
    queryClient.prefetchQuery(trpc.public.events.featured.queryOptions()),
    queryClient.prefetchQuery(
      // Built by the same function as the grid's own query, so the keys match
      // and the grid hydrates instead of refetching.
      trpc.public.events.list.queryOptions(
        eventsListInput(DEFAULT_EVENTS_LIST_STATE)
      )
    ),
  ])

  return (
    <HydrateClient>
      <EventsPageHeader />
      <FeaturedEvents />
      <EventsGridSection />
    </HydrateClient>
  )
}

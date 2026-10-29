'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'

import { FeaturedEventCard } from '@/components/cards/featured-event-card'
import { useTRPC } from '@/lib/trpc'
import {
  EVENT_CARD_STATUS_LABEL,
  eventCardStatus,
  formatNaira,
} from '@/lib/event-display'
import type { BadgeTone } from '@/components/cards/featured-event-card'

const STATUS_TONE = {
  past: 'gray',
  'sold-out': 'amber',
  live: 'purple',
  upcoming: 'green',
} as const satisfies Record<string, BadgeTone>

function statusBadge(event: {
  eventDate: string | null
  endDate: string | null
  soldOut: boolean
  category: string | null
}) {
  const status = eventCardStatus(event)
  const label = EVENT_CARD_STATUS_LABEL[status]
  return {
    label: event.category ? `${label} · ${event.category}` : label,
    tone: STATUS_TONE[status],
  }
}

const EVENT_PLACEHOLDER = '/hero-bg.png'

export function FeaturedEvents() {
  const trpc = useTRPC()
  const { data: events = [], isLoading } = useQuery(
    trpc.public.events.featured.queryOptions()
  )

  if (!isLoading && events.length === 0) return null

  return (
    <section aria-label="Featured Events" className="w-full px-5 md:px-10">
      <div className="mx-auto max-w-360 py-10 md:py-16">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="font-heading text-foreground mb-6 text-2xl font-semibold tracking-tight md:text-2xl"
        >
          Featured Events
        </motion.h2>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3 lg:gap-8.75">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-muted h-72 animate-pulse rounded-2xl"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3 lg:gap-8.75">
            {events.map((event, i) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{
                  delay: i * 0.1,
                  duration: 0.5,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <FeaturedEventCard
                  id={event.id}
                  badge={statusBadge(event)}
                  title={event.title}
                  price={
                    event.minPrice > 0
                      ? formatNaira(event.minPrice)
                      : 'Free Entry'
                  }
                  date={event.eventDate}
                  endDate={event.endDate}
                  location={event.location}
                  imageUrl={event.bannerUrl ?? EVENT_PLACEHOLDER}
                  href={`/events/${event.slug}`}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

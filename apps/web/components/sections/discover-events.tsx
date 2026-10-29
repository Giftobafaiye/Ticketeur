'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'

import { EventCard } from '@/components/cards/event-card'
import { useTRPC } from '@/lib/trpc'
import {
  EVENT_CARD_STATUS_LABEL,
  eventCardStatus,
  formatNaira,
} from '@/lib/event-display'

const EVENT_PLACEHOLDER = '/hero-bg.png'

export function DiscoverEvents() {
  const trpc = useTRPC()
  const { data: events = [], isLoading } = useQuery(
    trpc.public.events.featured.queryOptions()
  )

  return (
    <section
      aria-label="Discover Events"
      className="w-full px-5 py-16 md:px-10 md:py-24"
    >
      <div className="mx-auto max-w-[1440px]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 flex flex-col items-start justify-between gap-4 md:mb-12 md:flex-row md:items-end"
        >
          <div className="flex flex-col gap-2">
            <h2 className="font-heading text-foreground text-3xl font-bold tracking-tight md:text-[40px] md:leading-[1.15]">
              Discover Events
            </h2>
            <p className="text-muted-foreground text-base">
              Hand-picked experiences you can&apos;t miss
            </p>
          </div>
          <Link
            href="/events"
            className="group text-primary hover:text-primary-hover inline-flex items-center gap-2 text-base font-medium transition-colors"
          >
            View all
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className="size-5 transition-transform duration-300 group-hover:translate-x-1"
              strokeWidth={2}
            />
          </Link>
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3 lg:gap-12">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-muted h-72 animate-pulse rounded-2xl"
              />
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            New events will appear here once organisers publish them.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3 lg:gap-12">
            {events.map((event, i) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{
                  delay: i * 0.1,
                  duration: 0.55,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <EventCard
                  id={event.id}
                  title={event.title}
                  category={event.category ?? ''}
                  overlayBadge={EVENT_CARD_STATUS_LABEL[eventCardStatus(event)]}
                  price={
                    event.minPrice > 0
                      ? `From ${formatNaira(event.minPrice)}`
                      : 'Free'
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

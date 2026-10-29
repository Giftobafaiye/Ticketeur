'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft02Icon,
  Calendar03Icon,
  Location01Icon,
} from '@hugeicons/core-free-icons'

import { Button } from '@ticketur/ui/components/button'

import { useOpenTickets } from '@/components/sections/event-detail/event-tabs'

export type EventHeroData = {
  title: string
  status: string
  date: string
  time?: string
  location: string
  imageUrl: string
  ended?: boolean
  soldOut?: boolean
}

export function EventHero({
  event,
  backHref = '/events',
}: {
  event: EventHeroData
  backHref?: string
}) {
  const openTickets = useOpenTickets()

  return (
    <section
      aria-label="Event hero"
      className="w-full px-5 pt-4 md:px-10 md:pt-6"
    >
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 md:gap-6">
        <Link
          href={backHref}
          aria-label="Back to events"
          className="text-foreground hover:bg-muted inline-flex size-11 items-center justify-center rounded-full transition-colors"
        >
          <HugeiconsIcon
            icon={ArrowLeft02Icon}
            className="size-6"
            strokeWidth={1.8}
          />
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full overflow-hidden rounded-[20px]"
        >
          <div className="bg-muted relative aspect-[1360/500] w-full md:max-h-[500px]">
            <Image
              src={event.imageUrl}
              alt={event.title}
              fill
              priority
              sizes="(min-width: 1440px) 1360px, 100vw"
              className="object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent"
            />
          </div>

          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 px-4 pb-5 md:flex-row md:items-end md:justify-between md:gap-6 md:px-10 md:pb-8">
            <div className="flex flex-col gap-2 md:gap-3">
              <span className="bg-primary text-primary-foreground inline-flex w-fit items-center rounded-lg px-3 py-1 text-xs font-semibold tracking-wider uppercase md:text-sm">
                {event.status}
              </span>
              <h1 className="font-heading text-3xl font-bold tracking-tight text-white md:text-5xl md:leading-[1.1]">
                {event.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/90 md:text-sm">
                <span className="flex items-center gap-1.5">
                  <HugeiconsIcon
                    icon={Calendar03Icon}
                    className="size-4"
                    strokeWidth={1.6}
                  />
                  {event.date}
                  {event.time ? ` • ${event.time}` : ''}
                </span>
                <span
                  aria-hidden
                  className="hidden h-4 w-px bg-white/40 md:block"
                />
                <span className="flex items-center gap-1.5">
                  <HugeiconsIcon
                    icon={Location01Icon}
                    className="size-4"
                    strokeWidth={1.6}
                  />
                  {event.location}
                </span>
              </div>
            </div>

            {event.ended ? (
              <span className="inline-flex w-fit items-center rounded-lg bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
                This event has ended
              </span>
            ) : (
              <Button
                size="xl"
                className="w-full md:w-auto"
                onClick={openTickets}
              >
                {event.soldOut ? 'View tickets' : 'Buy Ticket'}
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

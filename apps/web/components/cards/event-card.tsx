'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Calendar03Icon, Location01Icon } from '@hugeicons/core-free-icons'

import { cn } from '@ticketur/ui/lib/utils'
import { Button } from '@ticketur/ui/components/button'
import { formatEventDateRange } from '@/lib/date'

export type EventCardProps = {
  id?: string
  title: string
  category: string
  price: string
  date: string | Date | null
  endDate?: string | Date | null
  location: string
  imageUrl: string
  overlayBadge?: string
  href?: string
  className?: string
}

export function EventCard({
  title,
  category,
  price,
  date,
  endDate,
  location,
  imageUrl,
  overlayBadge,
  href = '#',
  className,
}: EventCardProps) {
  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className={cn(
        'group border-border bg-card flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm transition-shadow duration-300 hover:shadow-xl',
        className
      )}
    >
      <div className="bg-muted relative aspect-[418/221] w-full overflow-hidden">
        <Image
          src={imageUrl}
          alt={title}
          fill
          sizes="(min-width: 1024px) 420px, (min-width: 768px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        {overlayBadge ? (
          <span className="absolute top-3 left-3 rounded-lg bg-white/95 px-3 py-1 text-xs font-medium text-[#135bec] backdrop-blur-sm">
            {overlayBadge}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-6">
        {category ? (
          <span className="bg-muted text-muted-foreground inline-flex w-fit rounded px-2 py-1.5 text-sm font-semibold tracking-wider uppercase">
            {category}
          </span>
        ) : null}

        <div className="flex items-start justify-between gap-4">
          <h3 className="font-heading text-foreground text-xl font-bold">
            {title}
          </h3>
          <span className="font-heading text-primary shrink-0 text-lg font-bold">
            {price}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <HugeiconsIcon
              icon={Calendar03Icon}
              className="size-4 shrink-0"
              strokeWidth={1.6}
            />
            <span>{formatEventDateRange(date, endDate ?? null)}</span>
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <HugeiconsIcon
              icon={Location01Icon}
              className="size-4 shrink-0"
              strokeWidth={1.6}
            />
            <span className="truncate">{location}</span>
          </div>
        </div>

        <Button
          variant="outline-primary"
          size="xl"
          asChild
          className="mt-auto w-full"
        >
          <Link href={href}>Buy Ticket</Link>
        </Button>
      </div>
    </motion.article>
  )
}

'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'

import { VendorCard } from '@/components/cards/vendor-card'

export type EventVendor = {
  id: string
  vendorId: string | null
  businessName: string | null
  businessCategory: string | null
  businessDescription: string | null
  tagline: string | null
  image: string | null
}

const VENDOR_PLACEHOLDER = '/vendor-placeholder.svg'

export function VendorsTab({ vendors }: { vendors: EventVendor[] }) {
  if (vendors.length === 0) {
    return (
      <div className="border-border bg-muted/20 flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed p-10 text-center">
        <p className="font-heading text-foreground text-lg font-semibold">
          No vendors lined up yet
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          The organizer hasn&apos;t listed any vendors for this event.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-foreground text-2xl font-bold">
          Participating Vendors
        </h2>
        <p className="text-muted-foreground text-sm md:text-base">
          Explore our curated selection of vendors at this event. Tap any vendor
          to see their full profile.
        </p>
      </div>

      <div className="-mx-5 flex snap-x snap-mandatory scroll-px-5 [scrollbar-width:none] gap-4 overflow-x-auto px-5 pb-4 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 lg:gap-6 [&::-webkit-scrollbar]:hidden">
        {vendors.map((vendor, i) => {
          const name = vendor.businessName ?? 'Vendor'
          const description =
            vendor.tagline ??
            vendor.businessDescription ??
            vendor.businessCategory ??
            ''
          const href = vendor.vendorId
            ? `/vendors/${vendor.vendorId}`
            : undefined
          return (
            <motion.div
              key={vendor.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{
                delay: i * 0.08,
                duration: 0.4,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="w-[85%] shrink-0 snap-start sm:w-auto"
            >
              <VendorCard
                id={vendor.vendorId ?? vendor.id}
                name={name}
                description={description}
                imageUrl={vendor.image ?? VENDOR_PLACEHOLDER}
                href={href}
              />
            </motion.div>
          )
        })}
      </div>

      <Link
        href="/vendors/list"
        className="text-primary hover:text-primary-hover inline-flex items-center gap-1.5 self-start text-sm font-semibold transition-colors"
      >
        Browse all vendors
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          className="size-4"
          strokeWidth={2}
        />
      </Link>
    </div>
  )
}

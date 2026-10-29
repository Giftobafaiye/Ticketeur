'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'

import { VendorMarketplaceCard } from '@/components/cards/vendor-marketplace-card'
import { useTRPC } from '@/lib/trpc'

const VENDOR_PLACEHOLDER = '/vendor-placeholder.svg'

export function FeaturedVendors() {
  const trpc = useTRPC()
  const { data: vendors = [], isLoading } = useQuery(
    trpc.public.vendors.featured.queryOptions()
  )

  return (
    <section
      aria-label="Featured Vendors"
      className="border-border bg-background w-full border-t px-5 py-16 md:px-10 md:py-24"
    >
      <div className="mx-auto max-w-360">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 flex flex-col items-start justify-between gap-4 md:mb-12 md:flex-row md:items-end"
        >
          <div className="flex max-w-140 flex-col gap-2">
            <h2 className="font-heading text-foreground text-3xl font-bold tracking-tight md:text-[40px] md:leading-[1.15]">
              Our Featured Vendors
            </h2>
            <p className="text-muted-foreground text-base">
              Top-rated professionals providing world-class services for events
            </p>
          </div>
          <Link
            href="/vendors/list"
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
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-muted h-64 animate-pulse rounded-2xl"
              />
            ))}
          </div>
        ) : vendors.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            Featured vendors will appear here once approved.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {vendors.map((vendor, i) => (
              <motion.div
                key={vendor.id}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{
                  delay: i * 0.08,
                  duration: 0.5,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <VendorMarketplaceCard
                  id={vendor.id}
                  name={vendor.businessName ?? 'Vendor'}
                  category={vendor.businessCategory ?? null}
                  description={
                    vendor.tagline ??
                    vendor.businessDescription ??
                    vendor.businessCategory ??
                    ''
                  }
                  imageUrl={vendor.image ?? VENDOR_PLACEHOLDER}
                  location={vendor.location ?? null}
                  avgRating={vendor.avgRating ?? null}
                  reviewCount={vendor.reviewCount}
                  href={`/vendors/${vendor.id}`}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

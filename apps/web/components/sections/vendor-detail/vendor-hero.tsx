'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft02Icon,
  Calendar03Icon,
  CheckmarkBadge02Icon,
  Location01Icon,
  Ticket01Icon,
} from '@hugeicons/core-free-icons'

import { StarRating } from '@/components/sections/vendor-detail/star-rating'
import type { VendorRecord } from '@/lib/vendors'

export function VendorHero({
  vendor,
  bannerUrl,
  avgRating,
  reviewCount,
}: {
  vendor: VendorRecord
  bannerUrl?: string
  avgRating: number | null
  reviewCount: number
}) {
  return (
    <section
      aria-label="Vendor hero"
      className="w-full px-5 pt-4 md:px-10 md:pt-6"
    >
      <div className="mx-auto flex max-w-360 flex-col gap-6 md:gap-8">
        <Link
          href="/vendors/list"
          aria-label="Back to all vendors"
          className="text-foreground hover:bg-muted inline-flex size-11 items-center justify-center rounded-full transition-colors"
        >
          <HugeiconsIcon
            icon={ArrowLeft02Icon}
            className="size-6"
            strokeWidth={1.8}
          />
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full"
        >
          <div className="bg-muted relative -z-10 aspect-1360/360 w-full overflow-hidden rounded-[20px] md:aspect-1360/320">
            {bannerUrl ? (
              <Image
                src={bannerUrl}
                alt={`${vendor.name} banner`}
                fill
                priority
                sizes="(min-width: 1440px) 1360px, 100vw"
                className="object-cover"
              />
            ) : (
              // No banner uploaded: a neutral backdrop, not a stock photo
              // that reads as this vendor's own (it used to be a plate of
              // food on every profile, whatever the business).
              <div
                aria-hidden
                className="from-primary/35 via-primary/15 to-background absolute inset-0 bg-linear-to-br"
              />
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.15,
              duration: 0.5,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="border-border bg-card mx-4 -mt-16 flex flex-col gap-5 rounded-2xl border p-5 shadow-lg md:mx-8 md:-mt-20 md:flex-row md:items-center md:gap-6 md:p-6"
          >
            <div className="relative shrink-0">
              <div className="bg-muted relative size-24 overflow-hidden rounded-xl md:size-30">
                <Image
                  src={vendor.imageUrl}
                  alt={vendor.name}
                  fill
                  sizes="120px"
                  className="object-cover"
                />
              </div>
              {vendor.certified && (
                <div
                  aria-label="Verified vendor"
                  className="bg-primary dark:border-background absolute -right-1.5 -bottom-1.5 flex size-7 items-center justify-center rounded-full border-2 border-white"
                >
                  <HugeiconsIcon
                    icon={CheckmarkBadge02Icon}
                    className="size-4 text-white"
                    strokeWidth={2}
                  />
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight md:text-3xl">
                  {vendor.name}
                </h1>
                <span className="dark:text-muted-foreground inline-flex rounded bg-[#f1f1f1] px-2 py-1 text-xs font-semibold tracking-wider text-[#6d6d6d] uppercase dark:bg-white/10">
                  {vendor.category}
                </span>
              </div>
              <p className="text-muted-foreground text-sm md:text-base">
                {vendor.shortDescription}
              </p>
              <ul className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <StarRating value={avgRating ?? 0} size="sm" />
                  <span className="text-foreground font-medium">
                    {avgRating ? avgRating.toFixed(1) : 'No ratings yet'}
                  </span>
                  {reviewCount > 0 && <span>({reviewCount})</span>}
                </li>
                <li className="flex items-center gap-1.5">
                  <HugeiconsIcon
                    icon={Location01Icon}
                    className="size-4"
                    strokeWidth={1.6}
                  />
                  {vendor.location}
                </li>
                <li className="flex items-center gap-1.5">
                  <HugeiconsIcon
                    icon={Calendar03Icon}
                    className="size-4"
                    strokeWidth={1.6}
                  />
                  Partner since {vendor.partnerSince}
                </li>
                <li className="flex items-center gap-1.5">
                  <HugeiconsIcon
                    icon={Ticket01Icon}
                    className="size-4"
                    strokeWidth={1.6}
                  />
                  {vendor.hostedEvents} Hosted Events
                </li>
              </ul>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

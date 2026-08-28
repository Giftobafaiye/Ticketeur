'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { StarIcon } from '@hugeicons/core-free-icons'

import type { RouterOutputs } from '@ticketur/api'

import { useTRPC } from '@/lib/trpc'
import { StarRating } from '@/components/sections/vendor-detail/star-rating'

const RATING_LEVELS = [5, 4, 3, 2, 1] as const
const PAGE_STEP = 6

type RatingsData = RouterOutputs['vendor']['analytics']['ratings']
type ReviewRow = RatingsData['reviews']['rows'][number]

export function AnalyticsRatingsTab() {
  const trpc = useTRPC()
  const [shown, setShown] = useState(PAGE_STEP)

  const { data, isLoading } = useQuery(
    trpc.vendor.analytics.ratings.queryOptions({ page: 1, pageSize: shown })
  )

  const summary = data?.summary
  const average = summary?.average ?? 0
  const total = summary?.total ?? 0
  const rows = data?.reviews.rows ?? []
  const reviewTotal = data?.reviews.total ?? 0

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="border-border/60 bg-background rounded-2xl border p-5 shadow-sm shadow-black/[0.02] md:p-6"
      >
        <h2 className="font-heading text-foreground text-lg font-bold tracking-tight md:text-xl">
          Rating
        </h2>

        <div className="mt-5 grid grid-cols-[auto_1fr] gap-4 sm:gap-10">
          <div className="border-border flex flex-col items-start gap-1.5 pr-3 sm:border-r sm:pr-10">
            <span className="font-heading text-foreground text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              {average > 0 ? average.toFixed(1) : '0.0'}
            </span>
            <span className="text-muted-foreground text-sm">out of 5</span>
            <StarRating value={average} size="md" className="mt-1" />
          </div>

          <div className="flex flex-col justify-center gap-2.5">
            {RATING_LEVELS.map((level) => {
              const count = summary?.distribution[level] ?? 0
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={level} className="flex items-center gap-3">
                  <StarRating
                    value={level}
                    size="sm"
                    className="w-[88px] shrink-0 sm:w-[104px]"
                  />
                  <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground w-8 shrink-0 text-right text-sm tabular-nums">
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="border-border/60 mt-5 flex justify-end border-t pt-4">
          <span className="text-foreground text-sm font-bold">
            {total.toLocaleString()} {total === 1 ? 'Rating' : 'Ratings'}
          </span>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="border-border/60 bg-background rounded-2xl border p-5 md:p-6"
      >
        <h2 className="font-heading text-foreground text-lg font-bold tracking-tight md:text-xl">
          Reviews
        </h2>

        {isLoading ? (
          <div className="mt-4 flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-muted h-24 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyReviews />
        ) : (
          <div className="divide-border/70 mt-2 flex flex-col divide-y">
            {rows.map((review) => (
              <ReviewRow key={review.id} review={review} />
            ))}
          </div>
        )}

        {reviewTotal > rows.length && (
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE_STEP)}
              className="border-border text-foreground hover:border-primary hover:text-primary inline-flex items-center rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
            >
              Show more reviews
            </button>
          </div>
        )}
      </motion.section>
    </div>
  )
}

function ReviewRow({ review }: { review: ReviewRow }) {
  const initial = review.reviewerName.trim().charAt(0).toUpperCase() || '?'
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-2 last:pb-1">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
            {initial}
          </div>
          <div className="flex flex-col">
            <span className="text-foreground text-sm font-semibold">
              {review.reviewerName}
            </span>
            <span className="text-muted-foreground text-xs">
              &mdash; {roleLabel(review.reviewerRole)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StarRating value={review.rating} size="sm" />
          <span className="text-muted-foreground text-xs">
            {monthYear(review.createdAt)}
          </span>
        </div>
      </div>
      {review.comment ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          &ldquo;{review.comment}&rdquo;
        </p>
      ) : null}
    </div>
  )
}

function EmptyReviews() {
  return (
    <div className="border-border bg-muted/30 mt-4 flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-8 text-center">
      <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
        <HugeiconsIcon icon={StarIcon} className="size-6" strokeWidth={1.6} />
      </span>
      <p className="text-muted-foreground max-w-md text-sm leading-6">
        No reviews yet — they&rsquo;ll appear here as attendees and organizers
        rate your work.
      </p>
    </div>
  )
}

function roleLabel(role: string) {
  if (!role) return 'Guest'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function monthYear(value: Date | string) {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

import { and, asc, desc, eq, gte, ilike, ne, sql } from 'drizzle-orm'
import { z } from 'zod'

import type { Database } from '@ticketur/db'
import {
  events,
  eventVendors,
  ticketTiers,
  user,
  vendorProfileViews,
  vendorReviews,
} from '@ticketur/db'

import { createTRPCRouter, publicProcedure } from '../../trpc'
import { newId } from '../../lib/ids'
import {
  alreadyEnded,
  notCurrentlyBanned,
  stillRunning,
} from '../../lib/predicates'

const listInput = z.object({
  q: z.string().default(''),
  category: z.string().default('all'),
  location: z.string().default(''),
  minRating: z.number().min(0).max(5).default(0),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(12),
})

// Shared per-vendor rating aggregate, left-joined wherever a vendor row is
// selected so list/detail screens can show a rating badge without a
// separate round-trip. Vendors with zero reviews join to nulls.
function ratingAggSubquery(db: Database) {
  return db
    .select({
      vendorId: vendorReviews.vendorId,
      avgRating: sql<number>`AVG(${vendorReviews.rating})::float`.as(
        'avg_rating'
      ),
      reviewCount: sql<number>`COUNT(*)::int`.as('review_count'),
    })
    .from(vendorReviews)
    .groupBy(vendorReviews.vendorId)
    .as('rating_agg')
}

export const publicVendorsRouter = createTRPCRouter({
  list: publicProcedure.input(listInput).query(async ({ ctx, input }) => {
    const ratingAgg = ratingAggSubquery(ctx.db)

    const filters = [
      eq(user.role, 'vendor'),
      eq(user.vendorApprovalStatus, 'approved'),
      notCurrentlyBanned,
    ]
    if (input.q.trim().length > 0) {
      filters.push(ilike(user.businessName, `%${input.q.trim()}%`))
    }
    if (input.category !== 'all') {
      filters.push(eq(user.businessCategory, input.category))
    }
    if (input.location.trim().length > 0) {
      filters.push(ilike(user.vendorLocation, `%${input.location.trim()}%`))
    }
    if (input.minRating > 0) {
      filters.push(gte(ratingAgg.avgRating, input.minRating))
    }

    const rows = await ctx.db
      .select({
        id: user.id,
        businessName: user.businessName,
        businessCategory: user.businessCategory,
        businessDescription: user.businessDescription,
        tagline: user.vendorTagline,
        location: user.vendorLocation,
        image: user.image,
        bannerUrl: user.vendorBannerUrl,
        createdAt: user.createdAt,
        avgRating: ratingAgg.avgRating,
        reviewCount: ratingAgg.reviewCount,
      })
      .from(user)
      .leftJoin(ratingAgg, eq(ratingAgg.vendorId, user.id))
      .where(and(...filters))
      // Highest-rated first. `NULLS LAST` keeps unreviewed vendors from
      // floating to the top on DESC (Postgres puts NULLs first by default).
      // Review count breaks rating ties (more evidence = higher confidence),
      // then name for stable ordering across identical scores.
      .orderBy(
        sql`${ratingAgg.avgRating} desc nulls last`,
        sql`${ratingAgg.reviewCount} desc nulls last`,
        asc(user.businessName)
      )
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize)

    const totalCountRows = await ctx.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(user)
      .leftJoin(ratingAgg, eq(ratingAgg.vendorId, user.id))
      .where(and(...filters))

    return {
      rows: rows.map((row) => ({
        ...row,
        reviewCount: row.reviewCount ?? 0,
      })),
      total: totalCountRows[0]?.count ?? 0,
      page: input.page,
      pageSize: input.pageSize,
    }
  }),

  featured: publicProcedure.query(async ({ ctx }) => {
    const ratingAgg = ratingAggSubquery(ctx.db)

    const rows = await ctx.db
      .select({
        id: user.id,
        businessName: user.businessName,
        businessCategory: user.businessCategory,
        businessDescription: user.businessDescription,
        tagline: user.vendorTagline,
        location: user.vendorLocation,
        image: user.image,
        avgRating: ratingAgg.avgRating,
        reviewCount: ratingAgg.reviewCount,
      })
      .from(user)
      .leftJoin(ratingAgg, eq(ratingAgg.vendorId, user.id))
      .where(
        and(
          eq(user.role, 'vendor'),
          eq(user.vendorApprovalStatus, 'approved'),
          notCurrentlyBanned
        )
      )
      .orderBy(desc(user.createdAt))
      .limit(4)

    return rows.map((row) => ({
      ...row,
      reviewCount: row.reviewCount ?? 0,
    }))
  }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const ratingAgg = ratingAggSubquery(ctx.db)

      const found = await ctx.db
        .select({
          id: user.id,
          businessName: user.businessName,
          businessCategory: user.businessCategory,
          businessDescription: user.businessDescription,
          tagline: user.vendorTagline,
          location: user.vendorLocation,
          phone: user.vendorPhone,
          email: user.email,
          image: user.image,
          bannerUrl: user.vendorBannerUrl,
          instagramUrl: user.vendorInstagramUrl,
          websiteUrl: user.vendorWebsiteUrl,
          twitterUrl: user.vendorTwitterUrl,
          facebookUrl: user.vendorFacebookUrl,
          tiktokUrl: user.vendorTiktokUrl,
          linkedinUrl: user.vendorLinkedinUrl,
          youtubeUrl: user.vendorYoutubeUrl,
          whatsapp: user.vendorWhatsapp,
          expertise: user.vendorExpertise,
          focus: user.vendorFocus,
          experience: user.vendorExperience,
          showcaseImages: user.vendorShowcaseImages,
          vendorApprovalStatus: user.vendorApprovalStatus,
          createdAt: user.createdAt,
          avgRating: ratingAgg.avgRating,
          reviewCount: ratingAgg.reviewCount,
        })
        .from(user)
        .leftJoin(ratingAgg, eq(ratingAgg.vendorId, user.id))
        .where(
          and(
            eq(user.id, input.id),
            eq(user.role, 'vendor'),
            eq(user.vendorApprovalStatus, 'approved'),
            notCurrentlyBanned
          )
        )
        .limit(1)

      const vendor = found[0]
      if (!vendor) return null

      const hostedRows = await ctx.db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(eventVendors)
        .where(eq(eventVendors.vendorId, vendor.id))

      const today = new Date().toISOString().slice(0, 10)
      const participating = await ctx.db
        .select({
          id: events.id,
          slug: events.slug,
          title: events.title,
          eventDate: events.eventDate,
          endDate: events.endDate,
          eventTime: events.eventTime,
          location: events.location,
          bannerUrl: events.bannerUrl,
          status: events.status,
        })
        .from(eventVendors)
        .innerJoin(events, eq(events.id, eventVendors.eventId))
        .where(
          and(
            eq(eventVendors.vendorId, vendor.id),
            eq(events.status, 'upcoming'),
            // Without this an event that has already finished stayed in the
            // "participating" list and also matched `past` below, showing up
            // in both at once.
            stillRunning(today)
          )
        )
        .orderBy(asc(events.eventDate))
        .limit(6)

      // Attendee count per event = tickets sold across all of its tiers.
      const attendeeAgg = ctx.db
        .select({
          eventId: ticketTiers.eventId,
          attendeeCount:
            sql<number>`COALESCE(SUM(${ticketTiers.sold}), 0)::int`.as(
              'attendee_count'
            ),
        })
        .from(ticketTiers)
        .groupBy(ticketTiers.eventId)
        .as('attendee_agg')

      const past = await ctx.db
        .select({
          id: events.id,
          slug: events.slug,
          title: events.title,
          eventDate: events.eventDate,
          endDate: events.endDate,
          eventTime: events.eventTime,
          location: events.location,
          bannerUrl: events.bannerUrl,
          status: events.status,
          attendeeCount: attendeeAgg.attendeeCount,
        })
        .from(eventVendors)
        .innerJoin(events, eq(events.id, eventVendors.eventId))
        .leftJoin(attendeeAgg, eq(attendeeAgg.eventId, events.id))
        .where(
          and(
            eq(eventVendors.vendorId, vendor.id),
            // Was `lt(events.eventDate, today)`, which ignored endDate — a
            // multi-day event still running read as past on its second day.
            alreadyEnded(today),
            ne(events.status, 'suspended')
          )
        )
        .orderBy(desc(events.eventDate))
        .limit(6)

      return {
        ...vendor,
        reviewCount: vendor.reviewCount ?? 0,
        hostedEvents: hostedRows[0]?.count ?? 0,
        partnerSince: vendor.createdAt.getFullYear(),
        participatingEvents: participating,
        pastEvents: past.map((event) => ({
          ...event,
          attendeeCount: event.attendeeCount ?? 0,
        })),
        // Today is intentionally returned so the client doesn't have to
        // recompute timezone-sensitive comparisons.
        today,
      }
    }),

  // Records a profile view for the vendor Analytics screens. The public detail
  // page calls this once per browser session per vendor (see
  // vendor-detail-content). Best-effort: a vendor viewing their own profile is
  // skipped, and any write failure is swallowed so a page view never breaks
  // over a non-critical analytics insert.
  recordView: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const viewerId = ctx.session?.user.id ?? null
      if (viewerId && viewerId === input.id) return { ok: true }
      try {
        await ctx.db.insert(vendorProfileViews).values({
          id: newId('pv'),
          vendorId: input.id,
          viewerId,
        })
      } catch {
        // Non-critical — intentionally ignored.
      }
      return { ok: true }
    }),
})

export type PublicVendorsRouter = typeof publicVendorsRouter

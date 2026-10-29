import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  ne,
  sql,
  type SQL,
} from 'drizzle-orm'
import { z } from 'zod'

import { events, eventVendors, ticketTiers, user } from '@ticketur/db'

import { createTRPCRouter, publicProcedure } from '../../trpc'
import {
  alreadyEnded,
  hasEnded,
  notCurrentlyBanned,
  stillRunning,
} from '../../lib/predicates'
import { getFeeRates } from '../../lib/platform-settings'
import { EVENT_CATEGORIES, isEventCategory } from '../../lib/event-categories'

const listInput = z.object({
  q: z.string().default(''),
  // Kept for old clients that send a single category; `categories` wins.
  category: z.string().default('all'),
  categories: z
    .array(z.enum(EVENT_CATEGORIES))
    .max(EVENT_CATEGORIES.length)
    .default([]),
  // Free-text match on the venue, e.g. "Lagos" or "Eko Hotel".
  location: z.string().trim().max(120).default(''),
  // ISO YYYY-MM-DD: events running on that day (a multi-day event matches
  // every day it spans).
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  // Bounds on an event's cheapest ticket, in MINOR units (kobo). Null = open.
  priceMinMinor: z.number().int().min(0).nullable().default(null),
  priceMaxMinor: z.number().int().min(0).nullable().default(null),
  sort: z
    .enum(['soonest', 'newest', 'price-asc', 'price-desc', 'popular'])
    .default('soonest'),
  // 'upcoming' — still running (or TBD); 'past' — already finished. Past is a
  // showcase of what the platform has actually hosted, so it is ordered
  // most-recent-first and carries an attendee count instead of a price.
  tab: z.enum(['upcoming', 'past']).default('upcoming'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(12),
})

// The cheapest ticket, the tickets sold across tiers, and whether every tier is
// gone — per event, from the left-joined tiers.
const minPriceSql = sql<number>`COALESCE(MIN(${ticketTiers.priceMinor}), 0)::int`
const attendeeCountSql = sql<number>`COALESCE(SUM(${ticketTiers.sold}), 0)::int`
const soldOutSql = sql<boolean>`(COUNT(${ticketTiers.id}) > 0 AND COALESCE(SUM(${ticketTiers.sold}), 0) >= COALESCE(SUM(${ticketTiers.quantity}), 0))`

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export const publicEventsRouter = createTRPCRouter({
  list: publicProcedure.input(listInput).query(async ({ ctx, input }) => {
    const today = new Date().toISOString().slice(0, 10)

    const isPast = input.tab === 'past'
    // A concluded event keeps status 'upcoming' — it is the date that makes it
    // past, so nothing has to sweep the table to retire events.
    //
    // The past tab also surfaces 'archived' events: archiving is the organizer
    // clearing their own active list, not a request to erase an event that
    // already happened publicly. 'suspended' is deliberately NOT included —
    // that is an admin moderation state and must stay hidden everywhere.
    const filters: SQL[] = [
      isPast
        ? inArray(events.status, ['upcoming', 'archived'])
        : eq(events.status, 'upcoming'),
      isPast ? alreadyEnded(today) : stillRunning(today),
      notCurrentlyBanned,
    ]
    const q = input.q.trim()
    if (q.length > 0) {
      filters.push(ilike(events.title, `%${escapeLike(q)}%`))
    }
    if (input.location.length > 0) {
      filters.push(ilike(events.location, `%${escapeLike(input.location)}%`))
    }
    if (input.date) {
      filters.push(
        sql`${events.eventDate} <= ${input.date} AND COALESCE(${events.endDate}, ${events.eventDate}) >= ${input.date}`
      )
    }
    const categories =
      input.categories.length > 0
        ? input.categories
        : isEventCategory(input.category)
          ? [input.category]
          : []
    if (categories.length > 0) {
      filters.push(inArray(events.category, categories))
    }

    // Price bounds apply to the cheapest ticket, so they are a HAVING on the
    // grouped tiers rather than a WHERE.
    const having: SQL[] = []
    if (input.priceMinMinor !== null) {
      having.push(sql`${minPriceSql} >= ${input.priceMinMinor}`)
    }
    if (input.priceMaxMinor !== null) {
      having.push(sql`${minPriceSql} <= ${input.priceMaxMinor}`)
    }

    const grouped = ctx.db
      .select({
        id: events.id,
        slug: events.slug,
        title: events.title,
        eventDate: events.eventDate,
        endDate: events.endDate,
        eventTime: events.eventTime,
        location: events.location,
        category: events.category,
        bannerUrl: events.bannerUrl,
        createdAt: events.createdAt,
        minPrice: minPriceSql.as('minPrice'),
        attendeeCount: attendeeCountSql.as('attendeeCount'),
        soldOut: soldOutSql.as('soldOut'),
      })
      .from(events)
      .innerJoin(user, eq(user.id, events.organizerId))
      .leftJoin(ticketTiers, eq(ticketTiers.eventId, events.id))
      .where(and(...filters))
      .groupBy(events.id)
      .having(having.length > 0 ? and(...having) : undefined)
      .as('grouped')

    // Upcoming: soonest first by default. Past: most recently finished first —
    // ordered by the same date that decides whether it is past at all, so a
    // multi-day event does not sort by a start date it outlived.
    const order = isPast
      ? [desc(sql`COALESCE(${grouped.endDate}, ${grouped.eventDate})`)]
      : input.sort === 'newest'
        ? [desc(grouped.createdAt)]
        : input.sort === 'price-asc'
          ? [asc(grouped.minPrice), asc(grouped.eventDate)]
          : input.sort === 'price-desc'
            ? [desc(grouped.minPrice), asc(grouped.eventDate)]
            : input.sort === 'popular'
              ? [desc(grouped.attendeeCount), asc(grouped.eventDate)]
              : [sql`${grouped.eventDate} ASC NULLS LAST`]

    const [rows, totalCountRows] = await Promise.all([
      ctx.db
        .select({
          id: grouped.id,
          slug: grouped.slug,
          title: grouped.title,
          eventDate: grouped.eventDate,
          endDate: grouped.endDate,
          eventTime: grouped.eventTime,
          location: grouped.location,
          category: grouped.category,
          bannerUrl: grouped.bannerUrl,
          minPrice: grouped.minPrice,
          attendeeCount: grouped.attendeeCount,
          soldOut: grouped.soldOut,
        })
        .from(grouped)
        .orderBy(...order, asc(grouped.id))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      ctx.db.select({ count: sql<number>`COUNT(*)::int` }).from(grouped),
    ])

    return {
      rows,
      total: totalCountRows[0]?.count ?? 0,
      page: input.page,
      pageSize: input.pageSize,
    }
  }),

  // Type-ahead for the search bars: events whose title matches what the buyer
  // has typed so far, and the venues of upcoming events matching a location
  // prefix. Only what is publicly listed; a handful of rows each.
  suggest: publicProcedure
    .input(
      z.object({
        q: z.string().trim().max(120).default(''),
        location: z.string().trim().max(120).default(''),
      })
    )
    .query(async ({ ctx, input }) => {
      const today = new Date().toISOString().slice(0, 10)
      const visible = and(
        eq(events.status, 'upcoming'),
        stillRunning(today),
        notCurrentlyBanned
      )

      const [matches, locations] = await Promise.all([
        input.q.length > 0
          ? ctx.db
              .select({
                id: events.id,
                slug: events.slug,
                title: events.title,
                eventDate: events.eventDate,
                endDate: events.endDate,
                location: events.location,
              })
              .from(events)
              .innerJoin(user, eq(user.id, events.organizerId))
              .where(
                and(
                  visible,
                  ilike(events.title, `%${escapeLike(input.q)}%`),
                  input.location.length > 0
                    ? ilike(events.location, `%${escapeLike(input.location)}%`)
                    : undefined
                )
              )
              // Titles that start with what was typed first, then soonest.
              .orderBy(
                sql`(${events.title} ILIKE ${`${escapeLike(input.q)}%`}) DESC`,
                sql`${events.eventDate} ASC NULLS LAST`
              )
              .limit(6)
          : Promise.resolve([]),
        ctx.db
          .selectDistinct({ location: events.location })
          .from(events)
          .innerJoin(user, eq(user.id, events.organizerId))
          .where(
            and(
              visible,
              input.location.length > 0
                ? ilike(events.location, `%${escapeLike(input.location)}%`)
                : undefined
            )
          )
          .orderBy(asc(events.location))
          .limit(200),
      ])

      // Venues are free text ("Eko Hotel, Victoria Island, Lagos"); the
      // dropdown offers the place a buyer thinks in — the last part, usually
      // the city — and filtering by it matches every venue there.
      const typed = input.location.toLowerCase()
      const places = new Map<string, string>()
      for (const { location } of locations) {
        const place = location.split(',').pop()?.trim()
        if (!place) continue
        const key = place.toLowerCase()
        if (typed && !key.includes(typed)) continue
        if (!places.has(key)) places.set(key, place)
      }

      return {
        events: matches,
        locations: [...places.values()]
          .sort((a, b) => a.localeCompare(b))
          .slice(0, 8),
      }
    }),

  featured: publicProcedure.query(async ({ ctx }) => {
    const today = new Date().toISOString().slice(0, 10)

    const minPriceExpr =
      sql<number>`COALESCE(MIN(${ticketTiers.priceMinor}), 0)::int`.as(
        'minPrice'
      )

    const rows = await ctx.db
      .select({
        id: events.id,
        slug: events.slug,
        title: events.title,
        eventDate: events.eventDate,
        endDate: events.endDate,
        eventTime: events.eventTime,
        location: events.location,
        category: events.category,
        bannerUrl: events.bannerUrl,
        minPrice: minPriceExpr,
        soldOut: soldOutSql,
      })
      .from(events)
      .innerJoin(user, eq(user.id, events.organizerId))
      .leftJoin(ticketTiers, eq(ticketTiers.eventId, events.id))
      .where(
        and(
          eq(events.status, 'upcoming'),
          stillRunning(today),
          notCurrentlyBanned
        )
      )
      .groupBy(events.id)
      .orderBy(desc(events.createdAt))
      .limit(3)

    return rows
  }),

  // Other upcoming events to surface on the detail page. Excludes the
  // current event; future iteration could match on category / location.
  similar: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const today = new Date().toISOString().slice(0, 10)
      const minPriceExpr =
        sql<number>`COALESCE(MIN(${ticketTiers.priceMinor}), 0)::int`.as(
          'minPrice'
        )

      const rows = await ctx.db
        .select({
          id: events.id,
          slug: events.slug,
          title: events.title,
          eventDate: events.eventDate,
          endDate: events.endDate,
          location: events.location,
          category: events.category,
          bannerUrl: events.bannerUrl,
          minPrice: minPriceExpr,
          soldOut: soldOutSql,
        })
        .from(events)
        .innerJoin(user, eq(user.id, events.organizerId))
        .leftJoin(ticketTiers, eq(ticketTiers.eventId, events.id))
        .where(
          and(
            ne(events.id, input.id),
            eq(events.status, 'upcoming'),
            stillRunning(today),
            notCurrentlyBanned
          )
        )
        .groupBy(events.id)
        .orderBy(asc(events.eventDate))
        .limit(3)

      return rows
    }),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const found = await ctx.db
        .select({ event: events })
        .from(events)
        .innerJoin(user, eq(user.id, events.organizerId))
        .where(
          and(
            eq(events.slug, input.slug),
            // 'archived' is allowed through so a past event listed in the
            // past tab still resolves; the date check below drops an archived
            // event that hasn't happened yet (the organizer withdrew it).
            // 'suspended' never resolves — admin moderation.
            inArray(events.status, ['upcoming', 'archived']),
            notCurrentlyBanned
          )
        )
        .limit(1)
      const event = found[0]?.event
      if (!event) return null

      const tiers = await ctx.db
        .select()
        .from(ticketTiers)
        .where(eq(ticketTiers.eventId, event.id))
        .orderBy(asc(ticketTiers.priceMinor), asc(ticketTiers.sortOrder))

      const vendors = await ctx.db
        .select({
          id: eventVendors.id,
          status: eventVendors.status,
          vendorId: user.id,
          businessName: user.businessName,
          businessCategory: user.businessCategory,
          businessDescription: user.businessDescription,
          tagline: user.vendorTagline,
          image: user.image,
        })
        .from(eventVendors)
        .innerJoin(user, eq(user.id, eventVendors.vendorId))
        .where(and(eq(eventVendors.eventId, event.id), notCurrentlyBanned))

      const minPrice = tiers.reduce(
        (min, t) => (min === null || t.priceMinor < min ? t.priceMinor : min),
        null as number | null
      )

      // A finished event stays reachable (its page is the public record of it)
      // but must not sell tickets. checkout.start rejects it server-side too;
      // this flag is what lets the UI say so instead of failing on submit.
      // A TBD event (null date) is never treated as ended.
      const ended = hasEnded(event)

      // An archived event is public only as a record of something that already
      // happened. Archived and still upcoming means the organizer pulled it.
      if (event.status === 'archived' && !ended) return null

      // The ticket service-fee rate travels with the tier prices it applies
      // to. The tickets tab already makes this query and renders a skeleton
      // until it lands, so by the time any price is on screen the rate is
      // there too — no second round trip, and no moment at which a subtotal is
      // shown without the fee that goes with it. DISPLAY only: checkout.start
      // re-reads the rate and that figure is what gets charged.
      const feeRates = await getFeeRates(ctx.db)

      return {
        event,
        tiers,
        vendors,
        minPriceMinor: minPrice ?? 0,
        hasEnded: ended,
        // Basis points (500 = 5%). Apply it with calculateFeeMinor from
        // @ticketur/api/lib/fees, the same function the server charges with.
        serviceFeeBps: feeRates.ticket,
      }
    }),
})

export type PublicEventsRouter = typeof publicEventsRouter

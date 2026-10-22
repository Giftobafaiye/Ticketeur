import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { tasks } from '@trigger.dev/sdk'
import { z } from 'zod'

import type { Database } from '@ticketur/db'
import { events, orders, user } from '@ticketur/db'

import { adminProcedure, createTRPCRouter } from '../../trpc'
import { NOT_ADMIN, notCurrentlyBanned } from '../../lib/predicates'

// One Resend send per recipient (privacy), so a big audience is fanned out to
// the broadcast task in chunks of this size.
const BATCH_SIZE = 100

// Who a message goes to. `everyone` and `role` never include admins or banned
// accounts; `users` targets exactly the picked ids (banned still excluded).
const audienceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('everyone') }),
  z.object({
    type: z.literal('role'),
    role: z.enum(['attendee', 'organizer', 'vendor']),
  }),
  z.object({
    type: z.literal('users'),
    userIds: z.array(z.string()).min(1).max(500),
  }),
  // Everyone who paid to come to one event. This is the audience a venue
  // change or a cancellation needs, and it is the one the other three cannot
  // express: 'everyone' is far too wide, and 'users' would mean picking
  // hundreds of people by hand.
  z.object({ type: z.literal('event'), eventId: z.string() }),
])
type Audience = z.infer<typeof audienceSchema>

function audienceFilter(audience: Audience) {
  switch (audience.type) {
    case 'everyone':
      return and(NOT_ADMIN, notCurrentlyBanned)
    case 'role':
      return and(eq(user.role, audience.role), notCurrentlyBanned)
    case 'users':
      return and(inArray(user.id, audience.userIds), notCurrentlyBanned)
    case 'event':
      // Resolved from `orders`, not `user` — see eventRecipients.
      return undefined
  }
}

export type Recipient = { email: string; name: string }

/**
 * Everyone holding a paid place at one event: ticket buyers and anyone who
 * paid a registration fee. Both are people who intend to turn up, which is
 * what a date or venue change is about.
 *
 * Read from `orders` rather than `user` on purpose — **a ticket buyer does
 * not need an account**. Guest checkout stores the buyer's own name and
 * address on the order, and those people are exactly the ones who would miss
 * a venue change if this only mailed registered users.
 *
 * Deduplicated on the lower-cased address, because one person may hold
 * several orders; the first non-empty name wins so the greeting is a name
 * rather than a blank.
 */
async function eventRecipients(
  db: Database,
  eventId: string
): Promise<Recipient[]> {
  const rows = await db
    .select({
      email: orders.buyerEmail,
      name: orders.buyerName,
    })
    .from(orders)
    .where(
      and(
        eq(orders.eventId, eventId),
        eq(orders.status, 'paid'),
        inArray(orders.type, ['ticket', 'registration_fee'])
      )
    )

  const byEmail = new Map<string, Recipient>()
  for (const row of rows) {
    const email = row.email.trim()
    if (email === '') continue
    const key = email.toLowerCase()
    const existing = byEmail.get(key)
    if (!existing) {
      byEmail.set(key, { email, name: row.name.trim() })
    } else if (existing.name === '' && row.name.trim() !== '') {
      existing.name = row.name.trim()
    }
  }
  return [...byEmail.values()]
}

async function resolveRecipients(
  db: Database,
  audience: Audience
): Promise<Recipient[]> {
  if (audience.type === 'event') return eventRecipients(db, audience.eventId)
  const rows = await db
    .select({ email: user.email, name: user.name })
    .from(user)
    .where(audienceFilter(audience))
  return rows.map((r) => ({ email: r.email, name: r.name ?? '' }))
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size))
  return out
}

export const adminEmailsRouter = createTRPCRouter({
  // Typeahead for the "specific users" picker.
  searchRecipients: adminProcedure
    .input(z.object({ q: z.string().trim().default('') }))
    .query(async ({ ctx, input }) => {
      const filters = [notCurrentlyBanned]
      if (input.q.length > 0) {
        const needle = `%${input.q}%`
        filters.push(or(ilike(user.name, needle), ilike(user.email, needle))!)
      }
      return ctx.db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        })
        .from(user)
        .where(and(...filters))
        .orderBy(desc(user.createdAt))
        .limit(20)
    }),

  // Typeahead for the event picker. Only events that have taken money are
  // worth listing here: an event with no paid orders has nobody to tell.
  searchEvents: adminProcedure
    .input(z.object({ q: z.string().trim().default('') }))
    .query(async ({ ctx, input }) => {
      const filters = [eq(orders.status, 'paid')]
      if (input.q.length > 0) {
        filters.push(ilike(events.title, `%${input.q}%`))
      }
      return ctx.db
        .select({
          id: events.id,
          title: events.title,
          eventDate: events.eventDate,
          location: events.location,
          buyers: sql<number>`COUNT(DISTINCT LOWER(${orders.buyerEmail}))::int`,
        })
        .from(events)
        .innerJoin(orders, eq(orders.eventId, events.id))
        .where(and(...filters))
        .groupBy(events.id)
        .orderBy(desc(events.createdAt))
        .limit(20)
    }),

  // Live headcount for the chosen audience, so the composer can show (and the
  // confirm dialog can state) exactly how many people a send reaches.
  recipientCount: adminProcedure
    .input(audienceSchema)
    .query(async ({ ctx, input }) => {
      // The event audience is deduplicated in memory (one person, several
      // orders), so it is counted by resolving it rather than by COUNT(*),
      // which would report orders instead of people.
      if (input.type === 'event') {
        const recipients = await eventRecipients(ctx.db, input.eventId)
        return { count: recipients.length }
      }
      const [row] = await ctx.db
        .select({ value: sql<number>`COUNT(*)::int` })
        .from(user)
        .where(audienceFilter(input))
      return { count: Number(row?.value ?? 0) }
    }),

  send: adminProcedure
    .input(
      z.object({
        audience: audienceSchema,
        subject: z.string().trim().min(1, 'Subject required').max(200),
        // Markdown from the composer, rendered into the branded template.
        body: z.string().trim().min(1, 'Message body required').max(20_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const recipients = await resolveRecipients(ctx.db, input.audience)
      if (recipients.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'That selection has no recipients to email.',
        })
      }

      // Fan out to the broadcast task in batches; each task sends one message
      // per recipient so nobody sees anyone else's address.
      for (const batch of chunk(recipients, BATCH_SIZE)) {
        await tasks.trigger('send-admin-broadcast', {
          subject: input.subject,
          body: input.body,
          recipients: batch,
          // "Dear Attendee" is the right thing to say to a ticket holder
          // whose account carries no name; "Dear there" is not.
          fallbackName: input.audience.type === 'event' ? 'Attendee' : 'there',
        })
      }

      return { recipients: recipients.length }
    }),
})

export type AdminEmailsRouter = typeof adminEmailsRouter

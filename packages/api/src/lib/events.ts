import { TRPCError } from '@trpc/server'
import { eq, inArray } from 'drizzle-orm'

import { db, events, ticketTiers, type EventPendingChanges } from '@ticketur/db'

import { newId } from './ids'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

// Sold-ticket guardrails, shared by the submit-time pre-check and the
// authoritative apply. A tier that has sold tickets can't be removed, and a
// tier's capacity can't drop below what's already been sold. Throws
// BAD_REQUEST with a friendly message; returns cleanly when the edit is safe.
function assertTierSoldConstraints(
  existing: { id: string; name: string; sold: number }[],
  payloadTiers: EventPendingChanges['tiers']
) {
  const existingById = new Map(existing.map((t) => [t.id, t]))
  const keptIds = new Set(
    payloadTiers
      .map((t) => t.id)
      .filter((id): id is string => Boolean(id) && existingById.has(id!))
  )
  for (const t of existing) {
    if (!keptIds.has(t.id) && t.sold > 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot remove "${t.name}" — it already has ${t.sold} ticket(s) sold.`,
      })
    }
  }
  for (const t of payloadTiers) {
    const current = t.id ? existingById.get(t.id) : undefined
    if (current && t.quantity < current.sold) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `"${t.name}" already has ${current.sold} sold; quantity can't be lower.`,
      })
    }
  }
}

// Read-only pre-check (no lock) so an organizer gets immediate feedback at
// submit time before an edit is queued for approval. The apply below re-checks
// authoritatively.
export async function assertEventEditAllowed(
  eventId: string,
  payload: EventPendingChanges
) {
  const existing = await db
    .select({
      id: ticketTiers.id,
      name: ticketTiers.name,
      sold: ticketTiers.sold,
    })
    .from(ticketTiers)
    .where(eq(ticketTiers.eventId, eventId))
  assertTierSoldConstraints(existing, payload.tiers)
}

// Apply an edit payload to the live event and reconcile its tiers, inside a
// transaction. Shared by the direct-edit path (draft/in-review events) and the
// admin-approval path (a pending edit on a live event). Reads tiers with a row
// lock and re-validates sold counts, so a purchase landing mid-approval can't
// slip past. Tiers are matched by id; anything without a known id is new.
export async function applyEventEdit(
  tx: DbTransaction,
  eventId: string,
  payload: EventPendingChanges
) {
  const existingTiers = await tx
    .select()
    .from(ticketTiers)
    .where(eq(ticketTiers.eventId, eventId))
    .for('update')

  assertTierSoldConstraints(existingTiers, payload.tiers)

  const existingById = new Map(existingTiers.map((t) => [t.id, t]))
  const keptIds = new Set(
    payload.tiers
      .map((t) => t.id)
      .filter((id): id is string => Boolean(id) && existingById.has(id!))
  )

  await tx
    .update(events)
    .set({
      title: payload.title,
      description: payload.description,
      eventDate: payload.date,
      endDate:
        payload.endDate && payload.endDate !== payload.date
          ? payload.endDate
          : null,
      eventTime: payload.time,
      location: payload.location,
      // An edit that doesn't carry a category (queued before they existed, or
      // a caller that omits it) leaves the event's category alone.
      ...(payload.category !== undefined && { category: payload.category }),
      bannerUrl: payload.bannerUrl ?? null,
      features: payload.features,
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId))

  const removeIds = existingTiers
    .filter((t) => !keptIds.has(t.id))
    .map((t) => t.id)
  if (removeIds.length > 0) {
    await tx.delete(ticketTiers).where(inArray(ticketTiers.id, removeIds))
  }

  for (const [idx, tier] of payload.tiers.entries()) {
    if (tier.id && existingById.has(tier.id)) {
      await tx
        .update(ticketTiers)
        .set({
          name: tier.name,
          quantity: tier.quantity,
          priceMinor: tier.priceMinor,
          sortOrder: idx,
        })
        .where(eq(ticketTiers.id, tier.id))
    } else {
      await tx.insert(ticketTiers).values({
        id: newId('tier'),
        eventId,
        name: tier.name,
        quantity: tier.quantity,
        priceMinor: tier.priceMinor,
        sortOrder: idx,
      })
    }
  }
}

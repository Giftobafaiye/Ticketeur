import { and, eq, isNull } from 'drizzle-orm'
import { tasks } from '@trigger.dev/sdk'

import {
  events,
  eventVendors,
  externalVendorInvites,
  user,
  type Database,
} from '@ticketur/db'

import { getBaseUrl } from './base-url'
import { newId } from './ids'

// Organizers invite vendors who are not on the platform yet by email, on the
// create-event form. Two rules keep that from being a lever over other
// people's accounts:
//
//   1. An invite never changes an existing account. An email that already
//      belongs to a vendor gets linked to the event; one that belongs to an
//      attendee, an organizer or an admin is left exactly as it is, and that
//      person is not emailed. Before this, inviting an admin's address turned
//      the admin into a pending vendor and locked them out of the console.
//   2. Nothing leaves the building until an admin has approved the event. The
//      create mutation only records the invites; this runs when the event goes
//      live (approveEvent, or an admin creating it live). A draft that is
//      never submitted sends no Ticketeur-branded mail to anyone, so the form
//      cannot be used to spam arbitrary addresses.
//
// Safe to call more than once for the same event: each invite is claimed by a
// conditional UPDATE on `sent_at`, so a re-approval or a double click sends
// each invite at most once.
export async function deliverExternalVendorInvites(
  db: Database,
  eventId: string
): Promise<void> {
  const claimed = await db
    .update(externalVendorInvites)
    .set({ sentAt: new Date() })
    .where(
      and(
        eq(externalVendorInvites.eventId, eventId),
        isNull(externalVendorInvites.sentAt)
      )
    )
    .returning()

  if (claimed.length === 0) return

  const [ev] = await db
    .select({
      title: events.title,
      organizerName: user.name,
      orgName: user.orgName,
    })
    .from(events)
    .innerJoin(user, eq(user.id, events.organizerId))
    .where(eq(events.id, eventId))
    .limit(1)
  if (!ev) return

  const baseUrl = getBaseUrl()

  for (const inv of claimed) {
    const email = inv.email.toLowerCase()
    const [existing] = await db
      .select({ id: user.id, role: user.role })
      .from(user)
      .where(eq(user.email, email))
      .limit(1)

    let vendorId: string
    if (!existing) {
      // Stub vendor account; they set a password through the sign-up /
      // forgot-password flow the invite email points them to. A concurrent
      // sign-up with the same address wins: the insert yields, and the row
      // it created is read back and checked like any other existing account.
      const now = new Date()
      const [created] = await db
        .insert(user)
        .values({
          id: newId('usr'),
          name: inv.contactName,
          email,
          emailVerified: false,
          role: 'vendor',
          vendorApprovalStatus: 'pending',
          businessName: inv.businessName,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({ target: user.email })
        .returning({ id: user.id })
      if (!created) continue
      vendorId = created.id
    } else if (existing.role === 'vendor') {
      vendorId = existing.id
    } else {
      // Rule 1: someone else's account. Leave it alone.
      console.warn('[vendor-invite] skipped: email belongs to a non-vendor', {
        eventId,
        inviteId: inv.id,
        role: existing.role ?? null,
      })
      continue
    }

    const [linked] = await db
      .select({ id: eventVendors.id })
      .from(eventVendors)
      .where(
        and(
          eq(eventVendors.eventId, eventId),
          eq(eventVendors.vendorId, vendorId)
        )
      )
      .limit(1)
    if (!linked) {
      await db.insert(eventVendors).values({
        id: newId('evnd'),
        eventId,
        vendorId,
        status: 'invited',
      })
    }

    void tasks.trigger('send-vendor-invite', {
      email,
      businessName: inv.businessName,
      contactName: inv.contactName,
      organizerName: ev.orgName ?? ev.organizerName,
      eventTitle: ev.title,
      signupUrl: `${baseUrl}/signup?role=vendor&invite=vendor&email=${encodeURIComponent(email)}`,
    })
  }
}

import { z } from 'zod'
import { count, desc, eq, inArray, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

import {
  payoutAccounts,
  payoutAdjustments,
  payouts,
  payoutSettings,
  user,
} from '@ticketur/db'
import {
  loadAllOrganizerBalances,
  loadOrganizerBalance,
  newPayoutRowId,
} from '@ticketur/db/payouts'

import { adminProcedure, createTRPCRouter } from '../../trpc'
import { payoutsMode } from '../../lib/payouts'

// The admin side of payouts: every organizer's balance, the adjustments that
// correct it, and (with the request flow) the queue of withdrawals to decide.
//
// ── Why an admin can never act on their own balance ──
// Admins pass the organizer check elsewhere in the app, so an admin can own
// events. Crediting your own balance, or releasing your own earnings early, is
// the one thing a reviewer must never be able to do to themselves.

function assertNotSelf(adminId: string, organizerId: string): void {
  if (adminId === organizerId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You cannot change payouts for your own account.',
    })
  }
}

const organizerIdInput = z.object({ organizerId: z.string().min(1) })

export const adminPayoutsRouter = createTRPCRouter({
  /** The headline numbers, and the count the sidebar badge shows. */
  stats: adminProcedure.query(async ({ ctx }) => {
    const [byStatus, balances] = await Promise.all([
      ctx.db
        .select({
          status: payouts.status,
          n: count(payouts.id),
          totalMinor: sql<string>`coalesce(sum(${payouts.amountMinor}), 0)`,
        })
        .from(payouts)
        .groupBy(payouts.status),
      loadAllOrganizerBalances(ctx.db),
    ])

    const n = (status: string) =>
      Number(byStatus.find((r) => r.status === status)?.n ?? 0)
    const total = (status: string) =>
      Number(byStatus.find((r) => r.status === status)?.totalMinor ?? 0)

    let availableMinor = 0
    let heldMinor = 0
    for (const b of balances) {
      availableMinor += Math.max(0, b.summary.availableMinor)
      heldMinor += b.summary.heldMinor
    }

    return {
      mode: payoutsMode(),
      awaitingReview: n('pending_review'),
      approved: n('approved'),
      processing: n('processing'),
      failed: n('failed'),
      // Needs a person: review, payment by hand, or a failed transfer.
      needsAction: n('pending_review') + n('approved') + n('failed'),
      inProgressMinor:
        total('pending_review') + total('approved') + total('processing'),
      paidOutMinor: total('paid'),
      // What organizers could ask for right now, and what is still on hold.
      availableMinor,
      heldMinor,
    }
  }),

  /** Every organizer with earnings, payouts or adjustments. */
  balances: adminProcedure.query(async ({ ctx }) => {
    const balances = await loadAllOrganizerBalances(ctx.db)
    const ids = balances.map((b) => b.organizerId)
    const profiles = ids.length
      ? await ctx.db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            orgName: user.orgName,
          })
          .from(user)
          .where(inArray(user.id, ids))
      : []
    const byId = new Map(profiles.map((p) => [p.id, p]))

    return balances.map(({ organizerId, summary }) => {
      const p = byId.get(organizerId)
      return {
        organizerId,
        // A soft-pointed organizer whose account was deleted still shows,
        // so money owed or paid to them stays visible.
        name: p?.orgName?.trim() || p?.name || 'Deleted account',
        email: p?.email ?? '',
        exists: Boolean(p),
        earnedMinor: summary.earnedMinor,
        heldMinor: summary.heldMinor,
        availableMinor: summary.availableMinor,
        withdrawableMinor: summary.withdrawableMinor,
        inProgressMinor: summary.inProgressMinor,
        paidOutMinor: summary.paidOutMinor,
        adjustmentsMinor: summary.adjustmentsMinor,
        earlyRelease: summary.earlyRelease,
      }
    })
  }),

  /** One organizer: the balance line by line, adjustments, payouts, accounts. */
  organizer: adminProcedure
    .input(organizerIdInput)
    .query(async ({ ctx, input }) => {
      const [profile] = await ctx.db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          orgName: user.orgName,
          role: user.role,
        })
        .from(user)
        .where(eq(user.id, input.organizerId))
        .limit(1)

      const [summary, adjustments, payoutRows, accounts] = await Promise.all([
        loadOrganizerBalance(ctx.db, input.organizerId),
        ctx.db
          .select()
          .from(payoutAdjustments)
          .where(eq(payoutAdjustments.organizerId, input.organizerId))
          .orderBy(desc(payoutAdjustments.createdAt)),
        ctx.db
          .select()
          .from(payouts)
          .where(eq(payouts.organizerId, input.organizerId))
          .orderBy(desc(payouts.requestedAt))
          .limit(100),
        ctx.db
          .select()
          .from(payoutAccounts)
          .where(eq(payoutAccounts.organizerId, input.organizerId))
          .orderBy(desc(payoutAccounts.createdAt)),
      ])

      if (!profile && summary.earnedMinor === 0 && payoutRows.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Organizer not found' })
      }

      return {
        organizerId: input.organizerId,
        profile: profile
          ? {
              name: profile.name,
              orgName: profile.orgName ?? '',
              email: profile.email,
              role: profile.role ?? 'attendee',
            }
          : null,
        isSelf: input.organizerId === ctx.session.user.id,
        summary,
        adjustments: adjustments.map((a) => ({
          id: a.id,
          amountMinor: a.amountMinor,
          kind: a.kind,
          reason: a.reason,
          createdByName: a.createdByName,
          createdAt: a.createdAt,
        })),
        payouts: payoutRows.map((p) => ({
          id: p.id,
          amountMinor: p.amountMinor,
          status: p.status,
          method: p.method,
          bankName: p.bankName,
          accountNumber: p.accountNumber,
          requestedAt: p.requestedAt,
          paidAt: p.paidAt,
        })),
        accounts: accounts.map((a) => ({
          id: a.id,
          bankName: a.bankName,
          accountNumber: a.accountNumber,
          accountName: a.accountName,
          status: a.status,
          createdAt: a.createdAt,
          retiredAt: a.retiredAt,
        })),
      }
    }),

  /**
   * Correct an organizer's balance. Append-only: a mistake is undone by
   * another adjustment, never by editing this one.
   *
   * `paid_outside` records money already handed over outside this system —
   * the payments made by hand before payouts existed — and always reduces the
   * balance. `correction` goes either way.
   */
  addAdjustment: adminProcedure
    .input(
      z.object({
        organizerId: z.string().min(1),
        kind: z.enum(['paid_outside', 'correction']),
        direction: z.enum(['credit', 'debit']),
        // Kobo, positive; the direction gives the sign.
        amountMinor: z
          .number()
          .int()
          .positive()
          .max(100_000_000_000),
        reason: z.string().trim().min(3).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertNotSelf(ctx.session.user.id, input.organizerId)
      if (input.kind === 'paid_outside' && input.direction !== 'debit') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Money paid outside the platform can only reduce a balance.',
        })
      }

      const [exists] = await ctx.db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, input.organizerId))
        .limit(1)
      if (!exists) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Organizer not found' })
      }

      const signed =
        input.direction === 'debit' ? -input.amountMinor : input.amountMinor
      await ctx.db.insert(payoutAdjustments).values({
        id: newPayoutRowId('pyadj'),
        organizerId: input.organizerId,
        amountMinor: signed,
        kind: input.kind,
        reason: input.reason,
        createdBy: ctx.session.user.id,
        createdByName: ctx.session.user.name,
        createdByEmail: ctx.session.user.email,
      })
      return { ok: true as const }
    }),

  /** Let an organizer withdraw as soon as money is paid, not after the event. */
  setEarlyRelease: adminProcedure
    .input(organizerIdInput.extend({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      assertNotSelf(ctx.session.user.id, input.organizerId)
      await ctx.db
        .insert(payoutSettings)
        .values({
          organizerId: input.organizerId,
          earlyRelease: input.enabled,
          updatedBy: ctx.session.user.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: payoutSettings.organizerId,
          set: {
            earlyRelease: input.enabled,
            updatedBy: ctx.session.user.id,
            updatedAt: new Date(),
          },
        })
      return { ok: true as const }
    }),

  /**
   * Requests waiting on a person — to review, to pay by hand, or a transfer
   * that failed — for the sidebar badge. One indexed count, on every page.
   * 'processing' is left out: that one is waiting on Flutterwave, not on us.
   */
  openCount: adminProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({ n: count(payouts.id) })
      .from(payouts)
      .where(inArray(payouts.status, ['pending_review', 'approved', 'failed']))
    return { count: Number(row?.n ?? 0) }
  }),
})

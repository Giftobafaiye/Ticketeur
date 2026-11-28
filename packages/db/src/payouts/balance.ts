import { and, eq, inArray, notExists, sql } from 'drizzle-orm'

import { events, orders } from '../schema/events'
import { paymentDiscrepancies } from '../schema/payments'
import {
  payoutAdjustments,
  payouts,
  payoutSettings,
  type PayoutStatus,
} from '../schema/payouts'

import {
  COMMITTED_PAYOUT_STATUSES,
  OWED_BACK_DISCREPANCY_KINDS,
} from './constants'
import { lagosDate } from './release'
import {
  summariseBalance,
  type BalanceSummary,
  type EventEarnings,
  type PayoutAmount,
} from './summary'
import type { DbExecutor } from './transitions'

// Loading what an organizer has earned and what has already gone, then
// handing it to summariseBalance. The earnings come straight from the orders:
//
//   share of an order = subtotal_minor − discount_minor   (never below zero)
//
// for every order that is `paid`, on an event the organizer owns, that has no
// owed-back refund record (OWED_BACK_DISCREPANCY_KINDS). That is exactly what
// checkout froze on the order: the buyer paid that plus the platform's service
// fee on top, and the fee is the platform's.
//
// Pass a transaction to read a consistent picture alongside a write (the
// request and approval paths do), or the pooled client for a page view.

const OWED_BACK = [...OWED_BACK_DISCREPANCY_KINDS]
const COMMITTED = [...COMMITTED_PAYOUT_STATUSES]

type OrganizerEventEarnings = EventEarnings & { organizerId: string }

/** Per-event earnings, for one organizer or for everyone. */
export async function loadEventEarnings(
  db: DbExecutor,
  organizerId?: string
): Promise<OrganizerEventEarnings[]> {
  const owedBack = db
    .select({ one: sql`1` })
    .from(paymentDiscrepancies)
    .where(
      and(
        eq(paymentDiscrepancies.orderId, orders.id),
        inArray(paymentDiscrepancies.kind, OWED_BACK)
      )
    )

  const rows = await db
    .select({
      organizerId: events.organizerId,
      eventId: events.id,
      title: events.title,
      eventDate: events.eventDate,
      endDate: events.endDate,
      paidOrders: sql<string>`count(${orders.id})`,
      earnedMinor: sql<string>`coalesce(sum(greatest(${orders.subtotalMinor} - ${orders.discountMinor}, 0)), 0)`,
    })
    .from(orders)
    .innerJoin(events, eq(events.id, orders.eventId))
    .where(
      and(
        eq(orders.status, 'paid'),
        organizerId ? eq(events.organizerId, organizerId) : undefined,
        notExists(owedBack)
      )
    )
    .groupBy(
      events.organizerId,
      events.id,
      events.title,
      events.eventDate,
      events.endDate
    )

  return rows.map((r) => ({
    organizerId: r.organizerId,
    eventId: r.eventId,
    title: r.title,
    lastDay: r.endDate ?? r.eventDate ?? null,
    paidOrders: Number(r.paidOrders),
    earnedMinor: Number(r.earnedMinor),
  }))
}

/** Payout totals by status, for the statuses that hold money. */
export async function loadPayoutAmounts(
  db: DbExecutor,
  organizerId?: string
): Promise<(PayoutAmount & { organizerId: string })[]> {
  const rows = await db
    .select({
      organizerId: payouts.organizerId,
      status: payouts.status,
      amountMinor: sql<string>`coalesce(sum(${payouts.amountMinor}), 0)`,
    })
    .from(payouts)
    .where(
      and(
        inArray(payouts.status, COMMITTED),
        organizerId ? eq(payouts.organizerId, organizerId) : undefined
      )
    )
    .groupBy(payouts.organizerId, payouts.status)
  return rows.map((r) => ({
    organizerId: r.organizerId,
    status: r.status as PayoutStatus,
    amountMinor: Number(r.amountMinor),
  }))
}

/** The signed sum of every adjustment, per organizer. */
export async function loadAdjustmentTotals(
  db: DbExecutor,
  organizerId?: string
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      organizerId: payoutAdjustments.organizerId,
      totalMinor: sql<string>`coalesce(sum(${payoutAdjustments.amountMinor}), 0)`,
    })
    .from(payoutAdjustments)
    .where(organizerId ? eq(payoutAdjustments.organizerId, organizerId) : undefined)
    .groupBy(payoutAdjustments.organizerId)
  return new Map(rows.map((r) => [r.organizerId, Number(r.totalMinor)]))
}

/** Organizers whose earnings release as soon as they are paid. */
export async function loadEarlyRelease(
  db: DbExecutor,
  organizerId?: string
): Promise<Set<string>> {
  const rows = await db
    .select({ organizerId: payoutSettings.organizerId })
    .from(payoutSettings)
    .where(
      and(
        eq(payoutSettings.earlyRelease, true),
        organizerId ? eq(payoutSettings.organizerId, organizerId) : undefined
      )
    )
  return new Set(rows.map((r) => r.organizerId))
}

/** One organizer's balance, as of `now`. */
export async function loadOrganizerBalance(
  db: DbExecutor,
  organizerId: string,
  opts: { now?: Date } = {}
): Promise<BalanceSummary> {
  const [earnings, amounts, adjustments, early] = await Promise.all([
    loadEventEarnings(db, organizerId),
    loadPayoutAmounts(db, organizerId),
    loadAdjustmentTotals(db, organizerId),
    loadEarlyRelease(db, organizerId),
  ])
  return summariseBalance({
    events: earnings,
    payouts: amounts,
    adjustmentsMinor: adjustments.get(organizerId) ?? 0,
    earlyRelease: early.has(organizerId),
    today: lagosDate(opts.now ?? new Date()),
  })
}

/**
 * Every organizer with anything to show — earnings, payouts or adjustments —
 * and their balance. For the admin console. Four grouped queries regardless of
 * how many organizers there are.
 */
export async function loadAllOrganizerBalances(
  db: DbExecutor,
  opts: { now?: Date } = {}
): Promise<{ organizerId: string; summary: BalanceSummary }[]> {
  const [earnings, amounts, adjustments, early] = await Promise.all([
    loadEventEarnings(db),
    loadPayoutAmounts(db),
    loadAdjustmentTotals(db),
    loadEarlyRelease(db),
  ])
  const today = lagosDate(opts.now ?? new Date())

  const ids = new Set<string>()
  for (const e of earnings) ids.add(e.organizerId)
  for (const a of amounts) ids.add(a.organizerId)
  for (const id of adjustments.keys()) ids.add(id)

  const out = [...ids].map((organizerId) => ({
    organizerId,
    summary: summariseBalance({
      events: earnings.filter((e) => e.organizerId === organizerId),
      payouts: amounts.filter((a) => a.organizerId === organizerId),
      adjustmentsMinor: adjustments.get(organizerId) ?? 0,
      earlyRelease: early.has(organizerId),
      today,
    }),
  }))
  out.sort(
    (a, b) =>
      b.summary.availableMinor - a.summary.availableMinor ||
      b.summary.earnedMinor - a.summary.earnedMinor
  )
  return out
}

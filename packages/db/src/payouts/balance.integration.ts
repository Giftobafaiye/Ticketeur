// The balance SQL and the database guards, against a real Postgres.
//
// Not part of `npm test` (the glob is *.test.ts): it needs a migrated
// database. Run it against a LOCAL one — it refuses anything else — from the
// repo root:
//
//   set -a && . ./.env; set +a
//   (cd packages/db && RESEND_API_KEY=re_placeholder node \
//     --import ./src/test-support/ts-resolve-hook.ts \
//     src/payouts/balance.integration.ts)
//
// Everything happens inside ONE transaction that is rolled back at the end,
// so the database is left exactly as it was.

import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'

const url = process.env.DATABASE_URL ?? ''
if (!/@(localhost|127\.0\.0\.1):\d+\//.test(url)) {
  console.error('Refusing to run: DATABASE_URL is not a local database.')
  process.exit(1)
}

const { db } = await import('../client')
const schema = await import('../schema')
const payoutsCore = await import('./index')

const {
  user,
  events,
  orders,
  paymentDiscrepancies,
  payouts,
  payoutAdjustments,
  payoutSettings,
  payoutAccounts,
  payoutEvents,
} = schema
const { loadOrganizerBalance, loadAllOrganizerBalances, transitionPayout } =
  payoutsCore

class Rollback extends Error {}

function pgCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } }
  return e?.code ?? e?.cause?.code
}

const run = Date.now().toString(36)
const id = (p: string) => `${p}_it_${run}_${randomUUID().slice(0, 8)}`
const now = new Date()

let checks = 0
function check(label: string, fn: () => void) {
  fn()
  checks++
  console.log(`  ✔ ${label}`)
}

try {
  await db.transaction(async (tx) => {
    const orgA = id('usr')
    const orgB = id('usr')
    const admin = id('usr')
    for (const [uid, role] of [
      [orgA, 'organizer'],
      [orgB, 'organizer'],
      [admin, 'admin'],
    ] as const) {
      await tx.insert(user).values({
        id: uid,
        name: `IT ${role} ${uid}`,
        email: `${uid}@it.invalid`,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        role,
      })
    }

    const evEnded = id('evt')
    const evFuture = id('evt')
    const evTbd = id('evt')
    await tx.insert(events).values([
      { id: evEnded, organizerId: orgA, title: 'Ended show', slug: id('s'), eventDate: '2026-07-22', eventTime: '18:00', location: 'Lagos' },
      { id: evFuture, organizerId: orgA, title: 'Future show', slug: id('s'), eventDate: '2099-12-30', endDate: '2099-12-31', eventTime: '18:00', location: 'Lagos' },
      { id: evTbd, organizerId: orgB, title: 'TBD show', slug: id('s'), eventDate: null, eventTime: '18:00', location: 'Abuja' },
    ])

    const rejectedReg = id('ord')
    await tx.insert(orders).values([
      // Share = 5,000,000 − 500,000 = 4,500,000
      { id: id('ord'), eventId: evEnded, quantity: 2, subtotalMinor: 5_000_000, discountMinor: 500_000, feeMinor: 225_000, totalMinor: 4_725_000, status: 'paid' },
      // Share = 2,000,000
      { id: id('ord'), eventId: evEnded, quantity: 1, subtotalMinor: 2_000_000, discountMinor: 0, feeMinor: 100_000, totalMinor: 2_100_000, status: 'paid' },
      // Not paid: excluded.
      { id: id('ord'), eventId: evEnded, quantity: 1, subtotalMinor: 9_999_900, feeMinor: 0, totalMinor: 9_999_900, status: 'pending' },
      // Paid, then the organizer rejected the application: owed back, excluded.
      { id: rejectedReg, eventId: evEnded, type: 'registration_fee', quantity: 1, subtotalMinor: 500_000, feeMinor: 25_000, totalMinor: 525_000, status: 'paid' },
      // Held: the event is in the future.
      { id: id('ord'), eventId: evFuture, type: 'vote_purchase', quantity: 1, subtotalMinor: 1_000_000, feeMinor: 50_000, totalMinor: 1_050_000, status: 'paid' },
      // Org B, undated event.
      { id: id('ord'), eventId: evTbd, quantity: 3, subtotalMinor: 3_000_000, feeMinor: 150_000, totalMinor: 3_150_000, status: 'paid' },
    ])
    await tx.insert(paymentDiscrepancies).values({
      id: id('pd'),
      kind: 'registration_rejected',
      orderId: rejectedReg,
      orderType: 'registration_fee',
      eventId: evEnded,
      flwTransactionId: 'it-1',
      expectedMinor: 525_000,
      paidMinor: 525_000,
      owedMinor: 525_000,
    })

    const snapshot = {
      bankCode: '044',
      bankName: 'Access Bank',
      accountNumber: '0690000031',
      accountName: 'IT ACCOUNT',
    }
    await tx.insert(payouts).values([
      { id: id('pyt'), organizerId: orgA, amountMinor: 1_000_000, status: 'paid', ...snapshot },
      { id: id('pyt'), organizerId: orgA, amountMinor: 2_000_000, status: 'failed', ...snapshot },
    ])
    await tx.insert(payoutAdjustments).values({
      id: id('adj'),
      organizerId: orgA,
      amountMinor: -500_000,
      kind: 'paid_outside',
      reason: 'Paid by bank transfer in October',
    })
    await tx.insert(payoutSettings).values({ organizerId: orgB, earlyRelease: true })

    console.log('balances')
    const a = await loadOrganizerBalance(tx, orgA, { now })
    check('A: earned excludes unpaid and owed-back orders', () =>
      assert.equal(a.earnedMinor, 7_500_000)
    )
    check('A: the ended event is released, the future one held', () => {
      assert.equal(a.releasedMinor, 6_500_000)
      assert.equal(a.heldMinor, 1_000_000)
    })
    check('A: paid counts, failed does not, adjustment applies', () => {
      assert.equal(a.paidOutMinor, 1_000_000)
      assert.equal(a.inProgressMinor, 0)
      assert.equal(a.adjustmentsMinor, -500_000)
      assert.equal(a.availableMinor, 5_000_000)
    })
    const b = await loadOrganizerBalance(tx, orgB, { now })
    check('B: early release frees an undated event', () => {
      assert.equal(b.earnedMinor, 3_000_000)
      assert.equal(b.availableMinor, 3_000_000)
      assert.equal(b.events[0]?.releaseDate, null)
    })
    const all = await loadAllOrganizerBalances(tx, { now })
    check('the all-organizers view agrees with the single view', () => {
      const fromAll = all.find((x) => x.organizerId === orgA)?.summary
      assert.equal(fromAll?.availableMinor, a.availableMinor)
      assert.equal(fromAll?.heldMinor, a.heldMinor)
    })

    console.log('database guards')
    const open1 = id('pyt')
    await tx.insert(payouts).values({ id: open1, organizerId: orgA, amountMinor: 100_000, ...snapshot })
    let code = ''
    try {
      await tx.transaction(async (sp) => {
        await sp.insert(payouts).values({ id: id('pyt'), organizerId: orgA, amountMinor: 100_000, ...snapshot })
      })
    } catch (err) {
      code = pgCode(err) ?? ''
    }
    check('a second open request is refused by the unique index', () =>
      assert.equal(code, '23505')
    )

    code = ''
    try {
      await tx.transaction(async (sp) => {
        await sp.insert(payouts).values({ id: id('pyt'), organizerId: orgB, amountMinor: 150_050, ...snapshot })
      })
    } catch (err) {
      code = pgCode(err) ?? ''
    }
    check('an amount that is not whole naira is refused', () =>
      assert.equal(code, '23514')
    )

    code = ''
    try {
      await tx.transaction(async (sp) => {
        await sp.insert(payoutAdjustments).values({ id: id('adj'), organizerId: orgA, amountMinor: 100, kind: 'paid_outside', reason: 'wrong way round' })
      })
    } catch (err) {
      code = pgCode(err) ?? ''
    }
    check('a positive "paid outside" adjustment is refused', () =>
      assert.equal(code, '23514')
    )

    await tx.insert(payoutAccounts).values({ id: id('pya'), organizerId: orgA, ...snapshot })
    code = ''
    try {
      await tx.transaction(async (sp) => {
        await sp.insert(payoutAccounts).values({ id: id('pya'), organizerId: orgA, ...snapshot })
      })
    } catch (err) {
      code = pgCode(err) ?? ''
    }
    check('a second ACTIVE bank account is refused', () =>
      assert.equal(code, '23505')
    )

    console.log('state machine')
    const actor = { type: 'admin' as const, id: admin, name: 'IT admin' }
    const approved = await transitionPayout(tx, {
      payoutId: open1,
      from: ['pending_review'],
      to: 'approved',
      actor,
      set: { reviewedBy: admin, reviewedByName: 'IT admin', reviewedAt: now },
    })
    check('pending_review → approved, recording who did it', () => {
      assert.equal(approved.ok, true)
      assert.ok(approved.ok && approved.payout.status === 'approved')
    })
    const cancel = await transitionPayout(tx, {
      payoutId: open1,
      from: ['pending_review'],
      to: 'cancelled',
      actor: { type: 'organizer', id: orgA, name: 'IT org' },
    })
    check('an approved payout can no longer be cancelled', () => {
      assert.equal(cancel.ok, false)
      assert.ok(!cancel.ok && cancel.reason === 'wrong_status')
    })
    const mine = await tx
      .select()
      .from(payoutEvents)
      .where(eq(payoutEvents.payoutId, open1))
    check('exactly one history row was written for the one move', () => {
      assert.equal(mine.length, 1)
      assert.equal(mine[0]?.fromStatus, 'pending_review')
      assert.equal(mine[0]?.toStatus, 'approved')
    })
    const afterApprove = await loadOrganizerBalance(tx, orgA, { now })
    check('the approved request is held against the balance', () =>
      assert.equal(afterApprove.availableMinor, 5_000_000 - 100_000)
    )

    throw new Rollback()
  })
} catch (err) {
  if (!(err instanceof Rollback)) throw err
}

console.log(`\n${checks} checks passed; everything rolled back.`)
process.exit(0)

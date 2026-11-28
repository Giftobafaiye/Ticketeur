// The payout routers end to end, against a real (LOCAL) Postgres.
//
// Not part of `npm test` (the glob is *.test.ts / *.spec.ts): it needs a
// migrated database. Runs under tsx, not `node --test`, because the full
// router pulls in lib/forms.ts, whose parameter properties Node's type
// stripping cannot load. From the repo root:
//
//   set -a && . ./.env; set +a
//   (cd packages/api && RESEND_API_KEY=re_placeholder \
//     BETTER_AUTH_SECRET=placeholder-placeholder-placeholder-42chars \
//     PAYOUTS_MODE=manual \
//     node ../../node_modules/.pnpm/tsx@4.23.15/node_modules/tsx/dist/cli.mjs \
//     src/payouts.integration.ts)
//
// The routers run with a TRANSACTION as their `ctx.db`, and that transaction
// is rolled back at the end, so nothing it writes survives.

import assert from 'node:assert/strict'

const url = process.env.DATABASE_URL ?? ''
if (!/@(localhost|127\.0\.0\.1):\d+\//.test(url)) {
  console.error('Refusing to run: DATABASE_URL is not a local database.')
  process.exit(1)
}

const { db, user, events, orders } = await import('@ticketur/db')
const { appRouter } = await import('./routers/_app')
const { createCallerFactory } = await import('./trpc')

const createCaller = createCallerFactory(appRouter)

class Rollback extends Error {}

const run = Date.now().toString(36)
const id = (p: string) =>
  `${p}_pit_${run}_${Math.random().toString(36).slice(2, 8)}`
const now = new Date()

let checks = 0
async function check(label: string, fn: () => unknown | Promise<unknown>) {
  await fn()
  checks++
  console.log(`  ✔ ${label}`)
}

async function rejects(fn: () => Promise<unknown>, code: string) {
  try {
    await fn()
  } catch (err) {
    assert.equal((err as { code?: string }).code, code)
    return
  }
  assert.fail(`expected ${code}`)
}

function sessionFor(u: { id: string; role: string; name: string; email: string }, impersonatedBy?: string) {
  return {
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
    session: {
      id: `s_${u.id}`,
      userId: u.id,
      token: `t_${u.id}`,
      expiresAt: new Date(now.getTime() + 3_600_000),
      createdAt: now,
      updatedAt: now,
      impersonatedBy,
    },
  } as never
}

try {
  await db.transaction(async (tx) => {
    const org = { id: id('usr'), role: 'organizer', name: 'IT Organizer', email: `${id('o')}@it.invalid` }
    const admin = { id: id('usr'), role: 'admin', name: 'IT Admin', email: `${id('a')}@it.invalid` }
    for (const u of [org, admin]) {
      await tx.insert(user).values({ ...u, emailVerified: true, createdAt: now, updatedAt: now })
    }
    const ended = id('evt')
    const future = id('evt')
    await tx.insert(events).values([
      { id: ended, organizerId: org.id, title: 'Ended', slug: id('s'), eventDate: '2026-07-22', eventTime: '18:00', location: 'Lagos' },
      { id: future, organizerId: org.id, title: 'Future', slug: id('s'), eventDate: '2099-12-31', eventTime: '18:00', location: 'Lagos' },
    ])
    await tx.insert(orders).values([
      { id: id('ord'), eventId: ended, quantity: 2, subtotalMinor: 12_400_000, feeMinor: 620_000, totalMinor: 13_020_000, status: 'paid' },
      { id: id('ord'), eventId: future, type: 'vote_purchase', quantity: 1, subtotalMinor: 7_760_000, feeMinor: 388_000, totalMinor: 8_148_000, status: 'paid' },
    ])

    const ctx = (session: unknown) =>
      createCaller({ session: session as never, db: tx as never, headers: null })
    const asOrg = ctx(sessionFor(org))
    const asAdmin = ctx(sessionFor(admin))

    console.log('organizer overview')
    const o1 = await asOrg.org.payouts.overview()
    await check('the ended event is withdrawable, the future one on hold', () => {
      assert.equal(o1.summary.withdrawableMinor, 12_400_000)
      assert.equal(o1.summary.heldMinor, 7_760_000)
      assert.equal(o1.events.length, 2)
    })
    await check('requests are open in manual mode for an organizer', () => {
      assert.equal(o1.mode, 'manual')
      assert.equal(o1.canRequest, true)
      assert.equal(o1.account, null)
    })

    console.log('admin balances')
    const balances = await asAdmin.admin.payouts.balances()
    await check('the organizer is listed with the same numbers', () => {
      const row = balances.find((b) => b.organizerId === org.id)
      assert.equal(row?.availableMinor, 12_400_000)
      assert.equal(row?.name, 'IT Organizer')
    })

    await asAdmin.admin.payouts.addAdjustment({
      organizerId: org.id,
      kind: 'paid_outside',
      direction: 'debit',
      amountMinor: 2_400_000,
      reason: 'Paid by hand in August',
    })
    const o2 = await asOrg.org.payouts.overview()
    await check('money paid outside comes off what can be withdrawn', () => {
      assert.equal(o2.summary.adjustmentsMinor, -2_400_000)
      assert.equal(o2.summary.withdrawableMinor, 10_000_000)
    })

    await check('"paid outside" cannot be a credit', () =>
      rejects(
        () =>
          asAdmin.admin.payouts.addAdjustment({
            organizerId: org.id,
            kind: 'paid_outside',
            direction: 'credit',
            amountMinor: 100,
            reason: 'nope',
          }),
        'BAD_REQUEST'
      )
    )
    await check('an admin cannot adjust their own balance', () =>
      rejects(
        () =>
          asAdmin.admin.payouts.addAdjustment({
            organizerId: admin.id,
            kind: 'correction',
            direction: 'credit',
            amountMinor: 100_000,
            reason: 'self',
          }),
        'FORBIDDEN'
      )
    )

    await asAdmin.admin.payouts.setEarlyRelease({ organizerId: org.id, enabled: true })
    const o3 = await asOrg.org.payouts.overview()
    await check('early release frees the held event', () => {
      assert.equal(o3.summary.heldMinor, 0)
      assert.equal(o3.summary.earlyRelease, true)
      assert.equal(o3.summary.withdrawableMinor, 10_000_000 + 7_760_000)
    })

    const detail = await asAdmin.admin.payouts.organizer({ organizerId: org.id })
    await check('the organizer detail shows the adjustment', () => {
      assert.equal(detail.adjustments.length, 1)
      assert.equal(detail.adjustments[0]?.amountMinor, -2_400_000)
      assert.equal(detail.isSelf, false)
    })

    await check('a non-admin cannot read admin balances', () =>
      rejects(() => asOrg.admin.payouts.balances(), 'FORBIDDEN')
    )

    throw new Rollback()
  })
} catch (err) {
  if (!(err instanceof Rollback)) throw err
}

console.log(`\n${checks} checks passed; everything rolled back.`)
process.exit(0)

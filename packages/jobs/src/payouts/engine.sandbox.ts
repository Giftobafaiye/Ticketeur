// The automatic payout path end to end against Flutterwave's TEST mode: the
// real engine and the real transfer client against Flutterwave's sandbox,
// with a LOCAL Postgres. Not part of `npm test`. It refuses a live key and a
// non-local database.
//
// Flutterwave refuses test transfers too until the calling machine's public
// IP is whitelisted (dashboard, in TEST mode: Settings → Whitelisted IP
// addresses). The script stops with that message if it is not.
//
// From the repo root:
//
//   set -a && . ./.env; set +a
//   export FLW_SECRET_KEY=FLWSECK_TEST-…
//   (cd packages/jobs && RESEND_API_KEY=re_placeholder node \
//     --import ./src/test-support/ts-resolve-hook.ts \
//     src/payouts/engine.sandbox.ts)
//
// What it shows, in order:
//   1. With the sandbox's real balance (₦0 available when this was written),
//      an approved payout waits for funds and nothing is sent.
//   2. With ONLY the balance read simulated as funded, the engine claims the
//      payout, creates a real test transfer and leaves the payout processing.
//   3. Sending again creates no second transfer.
//   4. The sweep polls Flutterwave until the transfer settles (test mode
//      settles a `_PMCKDU_1` reference after about a minute): the payout ends
//      paid and the organizer is told exactly once.
//   5. A late webhook for the same transfer changes nothing.
//
// The database rows live in one transaction that is rolled back at the end.
// The test transfer stays in the Flutterwave test account; it moves no money.

import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const url = process.env.DATABASE_URL ?? ''
if (!/@(localhost|127\.0\.0\.1):\d+\//.test(url)) {
  console.error('Refusing to run: DATABASE_URL is not a local database.')
  process.exit(1)
}

const transfers = await import('../utils/flutterwave-transfers')
const key = process.env.FLW_SECRET_KEY ?? ''
if (!transfers.isTestSecretKey(key)) {
  console.error('Refusing to run: FLW_SECRET_KEY is not a Flutterwave TEST key.')
  process.exit(1)
}

const dbModule = await import('@ticketur/db')
const core = await import('@ticketur/db/payouts')
const engine = await import('./engine')

const { db, user, events, orders, payouts, payoutTransfers } = dbModule

class Rollback extends Error {}

const run = Date.now().toString(36)
const id = (p: string) => `${p}_sbx_${run}_${randomUUID().slice(0, 8)}`
const now = new Date()
const AMOUNT_MINOR = 500_000 // ₦5,000
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

let checks = 0
async function check(label: string, fn: () => unknown | Promise<unknown>) {
  await fn()
  checks++
  console.log(`  ✔ ${label}`)
}

// Everything goes to the real sandbox except the balance read, which answers
// "₦10,000 available". Only used from step 2 on.
const fundedFetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const href = String(input instanceof Request ? input.url : input)
  if (new URL(href).pathname === '/v3/balances/NGN') {
    return new Response(
      JSON.stringify({
        status: 'success',
        data: { currency: 'NGN', available_balance: 10_000, ledger_balance: 10_000 },
      }),
      { status: 200 }
    )
  }
  return fetch(input, init)
}) as typeof fetch

const notified: { kind: string; payoutId: string; reference?: string }[] = []
const notify = async (
  kind: 'paid' | 'failed',
  payout: { id: string },
  extra: { reference?: string }
) => {
  notified.push({ kind, payoutId: payout.id, reference: extra.reference })
}

let outcome = 'incomplete'
try {
  await db.transaction(async (tx) => {
    const realDeps = { db: tx as never, fw: { secretKey: key }, notify }
    const deps = { db: tx as never, fw: { secretKey: key, fetchImpl: fundedFetch }, notify }

    const org = id('usr')
    await tx.insert(user).values({ id: org, name: 'Sandbox Org', email: `${org}@it.invalid`, emailVerified: true, createdAt: now, updatedAt: now, role: 'organizer' })
    const ev = id('evt')
    await tx.insert(events).values({ id: ev, organizerId: org, title: 'Ended show', slug: id('s'), eventDate: '2026-07-22', eventTime: '18:00', location: 'Lagos' })
    await tx.insert(orders).values({ id: id('ord'), eventId: ev, quantity: 1, subtotalMinor: 100_000_000, feeMinor: 0, totalMinor: 100_000_000, status: 'paid' })
    const pid = id('pyt')
    await tx.insert(payouts).values({
      id: pid, organizerId: org, organizerName: 'Sandbox Org', organizerEmail: `${org}@it.invalid`,
      amountMinor: AMOUNT_MINOR, status: 'approved', bankCode: '044', bankName: 'Access Bank',
      accountNumber: '0690000040', accountName: 'SANDBOX ORG',
    })
    const statusOf = async () => (await core.loadPayout(tx, pid))?.status
    const attempts = async () =>
      (await tx.select().from(payoutTransfers))
        .filter((r) => r.payoutId === pid)
        .sort((a, b) => a.attempt - b.attempt)

    console.log('1. the real sandbox balance')
    const balance = await transfers.getNgnBalance({ secretKey: key })
    console.log(`  balance read: ${JSON.stringify(balance)}`)
    if (balance.kind === 'found' && balance.availableMinor < AMOUNT_MINOR) {
      const waiting = await engine.sendApprovedPayout(realDeps, pid)
      await check('not enough available: the payout waits and nothing is sent', async () => {
        assert.equal(waiting.kind, 'waiting_for_funds')
        assert.equal(await statusOf(), 'approved')
        assert.equal((await attempts()).length, 0)
      })
    } else {
      console.log('  (the sandbox balance covers the payout, so there is no waiting case to show)')
    }

    console.log('2. send, with the balance read simulated as funded')
    const sent = await engine.sendApprovedPayout(deps, pid)
    console.log(`  engine said: ${JSON.stringify(sent)}`)
    if (sent.kind === 'refused') {
      outcome = `Flutterwave refused the transfer: ${sent.message}`
      throw new Rollback()
    }
    const [attempt] = await attempts()
    await check('a real test transfer was created and the payout is processing', async () => {
      assert.equal(sent.kind, 'sent')
      assert.ok(['processing', 'paid'].includes(String(await statusOf())))
      assert.ok(attempt?.flwTransferId, 'Flutterwave transfer id stored')
      assert.ok(attempt?.reference.endsWith('_PMCKDU_1'), 'test-mode success suffix')
    })
    console.log(`  transfer ${attempt!.flwTransferId}, reference ${attempt!.reference}`)

    console.log('3. send again')
    const again = await engine.sendApprovedPayout(deps, pid)
    await check('no second transfer: the payout is no longer approved', async () => {
      assert.equal(again.kind, 'skipped')
      assert.equal((await attempts()).length, 1)
    })

    console.log('4. sweep until Flutterwave settles it (about a minute in test mode)')
    const deadline = Date.now() + 4 * 60_000
    while (Date.now() < deadline) {
      const sweep = await engine.reconcilePayouts(deps, { sendApproved: false })
      const status = await statusOf()
      console.log(`  ${new Date().toISOString().slice(11, 19)}  payout ${status}  sweep ${JSON.stringify(sweep)}`)
      if (status === 'paid' || status === 'failed') break
      await sleep(15_000)
    }
    const [settled] = await attempts()
    await check('the payout is paid and its transfer successful', async () => {
      assert.equal(await statusOf(), 'paid')
      assert.equal(settled?.status, 'successful')
    })
    await check('the organizer was told exactly once, with the reference', () => {
      const mine = notified.filter((n) => n.payoutId === pid)
      assert.equal(mine.length, 1)
      assert.equal(mine[0]?.kind, 'paid')
      assert.equal(mine[0]?.reference, settled?.reference)
    })

    console.log('5. a late webhook for the same transfer')
    const late = await engine.settleFromWebhook(deps, {
      flwTransferId: String(settled!.flwTransferId),
      reference: settled!.reference,
    })
    await check('it changes nothing and tells nobody again', async () => {
      assert.equal(late.kind, 'applied')
      assert.equal(await statusOf(), 'paid')
      assert.equal(notified.filter((n) => n.payoutId === pid).length, 1)
    })

    const final = await transfers.getTransfer(String(settled!.flwTransferId), { secretKey: key })
    console.log(`  Flutterwave's record: ${JSON.stringify(final)}`)
    outcome = 'complete'
    throw new Rollback()
  })
} catch (err) {
  if (!(err instanceof Rollback)) throw err
}

if (outcome === 'complete') {
  console.log(`\n${checks} checks passed against the Flutterwave sandbox; database rolled back.`)
  process.exit(0)
}
console.log(`\nStopped after ${checks} checks: ${outcome}. Database rolled back.`)
process.exit(1)

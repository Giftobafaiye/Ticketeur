// The transfer engine against a real (LOCAL) Postgres, with Flutterwave
// scripted per scenario through the injected fetch. Not part of `npm test`.
// From the repo root:
//
//   set -a && . ./.env; set +a
//   (cd packages/jobs && RESEND_API_KEY=re_placeholder node \
//     --import ./src/test-support/ts-resolve-hook.ts \
//     src/payouts/engine.integration.ts)
//
// Everything runs inside one transaction that is rolled back at the end.

import assert from 'node:assert/strict'

const url = process.env.DATABASE_URL ?? ''
if (!/@(localhost|127\.0\.0\.1):\d+\//.test(url)) {
  console.error('Refusing to run: DATABASE_URL is not a local database.')
  process.exit(1)
}

const dbModule = await import('@ticketur/db')
const core = await import('@ticketur/db/payouts')
const engine = await import('./engine')

const { db, user, events, orders, payouts, payoutTransfers, payoutAdjustments } = dbModule

class Rollback extends Error {}

const run = Date.now().toString(36)
const id = (p: string) => `${p}_eit_${run}_${Math.random().toString(36).slice(2, 8)}`
const now = new Date()

let checks = 0
async function check(label: string, fn: () => unknown | Promise<unknown>) {
  await fn()
  checks++
  console.log(`  ✔ ${label}`)
}

// ─── A scriptable Flutterwave ───────────────────────────────────────────────

type Script = {
  balanceMinor: number
  create: (reference: string) => { status: number; body: unknown } | 'throw'
  // What GET /transfers/:id and ?reference= return, by reference.
  transfers: Map<string, { id: number; status: string; complete_message?: string }>
  creates: string[]
}
let script: Script

function transferBody(reference: string, t: { id: number; status: string; complete_message?: string }) {
  return {
    id: t.id,
    reference,
    status: t.status,
    amount: 50_000,
    fee: 26.875,
    currency: 'NGN',
    complete_message: t.complete_message ?? '',
    requires_approval: 0,
  }
}

const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
  const href = String(input instanceof Request ? input.url : input)
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
  const path = new URL(href).pathname + new URL(href).search
  if (path.startsWith('/v3/balances/NGN')) {
    return reply(200, {
      status: 'success',
      data: { currency: 'NGN', available_balance: script.balanceMinor / 100, ledger_balance: script.balanceMinor / 100 },
    })
  }
  if (path === '/v3/transfers' && init?.method === 'POST') {
    const body = JSON.parse(String(init.body)) as { reference: string }
    script.creates.push(body.reference)
    const answer = script.create(body.reference)
    if (answer === 'throw') throw new TypeError('fetch failed: socket hang up')
    return reply(answer.status, answer.body)
  }
  const byId = path.match(/^\/v3\/transfers\/(\d+)$/)
  if (byId) {
    for (const [reference, t] of script.transfers) {
      if (String(t.id) === byId[1]) {
        return reply(200, { status: 'success', data: transferBody(reference, t) })
      }
    }
    return reply(404, { status: 'error', message: 'Transfer not found' })
  }
  if (path.startsWith('/v3/transfers?')) {
    const ref = new URL(href).searchParams.get('reference') ?? ''
    const t = script.transfers.get(ref)
    return reply(200, { status: 'success', data: t ? [transferBody(ref, t)] : [] })
  }
  return reply(500, { status: 'error' })
}) as typeof fetch

const notified: { kind: string; payoutId: string; reference?: string }[] = []

try {
  await db.transaction(async (tx) => {
    const deps = {
      db: tx as never,
      fw: { secretKey: 'unit-test-live-key', fetchImpl },
      notify: async (kind: 'paid' | 'failed', payout: { id: string }, extra: { reference?: string }) => {
        notified.push({ kind, payoutId: payout.id, reference: extra.reference })
      },
    }

    const org = id('usr')
    await tx.insert(user).values({ id: org, name: 'Engine Org', email: `${org}@it.invalid`, emailVerified: true, createdAt: now, updatedAt: now, role: 'organizer' })
    const ev = id('evt')
    await tx.insert(events).values({ id: ev, organizerId: org, title: 'Ended', slug: id('s'), eventDate: '2026-07-22', eventTime: '18:00', location: 'Lagos' })
    await tx.insert(orders).values({ id: id('ord'), eventId: ev, quantity: 1, subtotalMinor: 100_000_000, feeMinor: 0, totalMinor: 100_000_000, status: 'paid' })

    // Each scenario needs its own payout; only one may be open at a time.
    const approvedPayout = async (amountMinor = 5_000_000) => {
      const pid = id('pyt')
      await tx.insert(payouts).values({
        id: pid, organizerId: org, organizerName: 'Engine Org', organizerEmail: `${org}@it.invalid`,
        amountMinor, status: 'approved', bankCode: '044', bankName: 'Access Bank',
        accountNumber: '0690000031', accountName: 'ENGINE ORG',
      })
      return pid
    }
    const statusOf = async (pid: string) => (await core.loadPayout(tx, pid))?.status
    // The jobs package has no drizzle-orm of its own to filter with, and the
    // table holds only this run's rows (it is all rolled back), so the
    // filtering is done here.
    const attemptsOf = async (pid: string) =>
      (await tx.select().from(payoutTransfers))
        .filter((r) => r.payoutId === pid)
        .sort((a, b) => a.attempt - b.attempt)

    console.log('accepted, then settled')
    script = {
      balanceMinor: 1_000_000_000,
      creates: [],
      transfers: new Map(),
      create: (reference) => {
        script.transfers.set(reference, { id: 9001, status: 'NEW' })
        return { status: 200, body: { status: 'success', message: 'Transfer Queued Successfully', data: transferBody(reference, { id: 9001, status: 'NEW' }) } }
      },
    }
    const p1 = await approvedPayout()
    const sent = await engine.sendApprovedPayout(deps, p1)
    await check('an approved payout is claimed, sent, and left processing', async () => {
      assert.deepEqual(sent, { kind: 'sent', state: 'pending' })
      assert.equal(await statusOf(p1), 'processing')
      const [a] = await attemptsOf(p1)
      assert.equal(a?.status, 'pending')
      assert.equal(a?.flwTransferId, '9001')
      assert.equal(a?.attempt, 1)
      assert.ok(a?.reference.startsWith('TKTP-'))
    })
    await check('sending again is a no-op: no second transfer', async () => {
      const again = await engine.sendApprovedPayout(deps, p1)
      assert.equal(again.kind, 'skipped')
      assert.equal(script.creates.length, 1)
    })
    const ref1 = (await attemptsOf(p1))[0]!.reference
    script.transfers.set(ref1, { id: 9001, status: 'SUCCESSFUL', complete_message: 'Transaction was successful' })
    const sweep1 = await engine.reconcilePayouts(deps, { sendApproved: false })
    await check('the sweep settles it as paid and tells the organizer once', async () => {
      assert.equal(sweep1.settled, 1)
      assert.equal(await statusOf(p1), 'paid')
      assert.deepEqual(notified.filter((n) => n.payoutId === p1).map((n) => n.kind), ['paid'])
      const payout = await core.loadPayout(tx, p1)
      assert.equal(payout?.method, 'transfer')
    })
    await check('the same answer again (a webhook replay) changes nothing', async () => {
      const res = await engine.settleFromWebhook(deps, { flwTransferId: '9001', reference: ref1 })
      assert.equal(res.kind, 'applied')
      assert.equal(notified.filter((n) => n.payoutId === p1).length, 1)
    })

    console.log('ambiguous create')
    script.create = () => 'throw'
    const p2 = await approvedPayout()
    const amb = await engine.sendApprovedPayout(deps, p2)
    const ref2 = (await attemptsOf(p2))[0]!.reference
    await check('a timed-out create leaves the attempt unconfirmed, not failed', async () => {
      assert.deepEqual(amb, { kind: 'sent', state: 'unconfirmed' })
      assert.equal(await statusOf(p2), 'processing')
      assert.equal((await attemptsOf(p2))[0]?.status, 'unconfirmed')
    })
    const sweep2 = await engine.reconcilePayouts(deps, { sendApproved: true })
    await check('Flutterwave not showing it yet is NOT read as failure, and nothing is resent', async () => {
      assert.equal(sweep2.unconfirmed, 1)
      assert.equal(await statusOf(p2), 'processing')
      assert.equal(script.creates.filter((r) => r === ref2).length, 1)
    })
    // It had arrived after all.
    script.transfers.set(ref2, { id: 9002, status: 'SUCCESSFUL' })
    await engine.reconcilePayouts(deps, { sendApproved: false })
    await check('once Flutterwave shows it, the sweep finds it by reference and settles it', async () => {
      assert.equal(await statusOf(p2), 'paid')
      assert.equal((await attemptsOf(p2))[0]?.flwTransferId, '9002')
    })

    console.log('refusal')
    script.create = () => ({ status: 400, body: { status: 'error', message: 'Please enable IP Whitelisting to access this service', data: null } })
    const p3 = await approvedPayout()
    const refused = await engine.sendApprovedPayout(deps, p3)
    await check('a refusal fails the attempt and the payout, without emailing the organizer', async () => {
      assert.equal(refused.kind, 'refused')
      assert.equal(await statusOf(p3), 'failed')
      assert.equal((await attemptsOf(p3))[0]?.status, 'failed')
      assert.equal(notified.filter((n) => n.payoutId === p3).length, 0)
      const payout = await core.loadPayout(tx, p3)
      assert.match(payout?.failureReason ?? '', /IP Whitelisting/)
    })
    // An admin retries (failed → approved); the next attempt gets a new reference.
    await tx.transaction(async (t2) => {
      await core.transitionPayout(t2, { payoutId: p3, from: ['failed'], to: 'approved', actor: { type: 'admin', id: null, name: 'IT' } })
    })
    script.create = (reference) => {
      script.transfers.set(reference, { id: 9003, status: 'SUCCESSFUL' })
      return { status: 200, body: { status: 'success', data: transferBody(reference, { id: 9003, status: 'SUCCESSFUL' }) } }
    }
    await engine.sendApprovedPayout(deps, p3)
    await check('a retry is attempt 2 with a new reference, and can settle at once', async () => {
      const attempts = await attemptsOf(p3)
      assert.equal(attempts.length, 2)
      assert.notEqual(attempts[0]!.reference, attempts[1]!.reference)
      assert.equal(attempts[1]?.status, 'successful')
      assert.equal(await statusOf(p3), 'paid')
    })

    console.log('duplicate reference')
    const p4 = await approvedPayout()
    script.create = (reference) => {
      // It arrived on an earlier call we never heard back from.
      script.transfers.set(reference, { id: 9004, status: 'PENDING' })
      return { status: 400, body: { status: 'error', message: 'Transfer reference already exists' } }
    }
    const dup = await engine.sendApprovedPayout(deps, p4)
    await check('a reused reference is looked up and recorded, never resent', async () => {
      assert.deepEqual(dup, { kind: 'sent', state: 'pending' })
      assert.equal((await attemptsOf(p4))[0]?.flwTransferId, '9004')
    })
    script.transfers.set((await attemptsOf(p4))[0]!.reference, { id: 9004, status: 'FAILED', complete_message: 'DISBURSE FAILED: Account is dormant' })
    await engine.settleFromWebhook(deps, { flwTransferId: '9004', reference: (await attemptsOf(p4))[0]!.reference })
    await check('a Flutterwave FAILED settles as failed and tells the organizer', async () => {
      assert.equal(await statusOf(p4), 'failed')
      assert.deepEqual(notified.filter((n) => n.payoutId === p4).map((n) => n.kind), ['failed'])
      assert.match((await core.loadPayout(tx, p4))?.failureReason ?? '', /dormant/)
    })
    // Clear it so the next scenario can open a payout.
    await tx.transaction(async (t2) => {
      await core.transitionPayout(t2, { payoutId: p4, from: ['failed'], to: 'rejected', actor: { type: 'admin', id: null, name: 'IT' } })
    })

    console.log('guards before sending')
    script.balanceMinor = 1_000_000
    const p5 = await approvedPayout()
    const creates = script.creates.length
    const waiting = await engine.sendApprovedPayout(deps, p5)
    await check('a short Flutterwave balance waits: still approved, no attempt spent', async () => {
      assert.equal(waiting.kind, 'waiting_for_funds')
      assert.equal(await statusOf(p5), 'approved')
      assert.equal((await attemptsOf(p5)).length, 0)
      assert.equal(script.creates.length, creates)
      assert.match((await core.loadPayout(tx, p5))?.failureReason ?? '', /Waiting for the Flutterwave balance/)
    })
    script.balanceMinor = 1_000_000_000
    await tx.insert(payoutAdjustments).values({ id: id('adj'), organizerId: org, amountMinor: -200_000_000, kind: 'correction', reason: 'Chargeback after approval' })
    const held = await engine.sendApprovedPayout(deps, p5)
    await check('a balance that no longer covers it is held, not sent', async () => {
      assert.equal(held.kind, 'held')
      assert.equal(await statusOf(p5), 'approved')
      assert.equal(script.creates.length, creates)
    })

    await check('a webhook for a reference that is not ours is ignored', async () => {
      const res = await engine.settleFromWebhook(deps, { flwTransferId: '1', reference: 'TKTP-nope-1' })
      assert.equal(res.kind, 'unknown_reference')
    })

    throw new Rollback()
  })
} catch (err) {
  if (!(err instanceof Rollback)) throw err
}

console.log(`\n${checks} checks passed; everything rolled back.`)
process.exit(0)

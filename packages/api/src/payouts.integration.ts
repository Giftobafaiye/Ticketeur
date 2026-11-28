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

// Flutterwave, answered in-process: the bank list and the name lookup the
// account flow calls. Everything else (Trigger.dev email queueing) gets a
// harmless 200 — the email helpers never throw either way.
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const href = String(input instanceof Request ? input.url : input)
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status })
  if (href.endsWith('/v3/banks/NG')) {
    return reply(200, {
      status: 'success',
      data: [
        { id: 1, code: '044', name: 'Access Bank' },
        { id: 2, code: '058', name: 'Guaranty Trust Bank' },
      ],
    })
  }
  if (href.endsWith('/v3/accounts/resolve')) {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      account_number?: string
    }
    return body.account_number === '0690000031' || body.account_number === '0690000032'
      ? reply(200, {
          status: 'success',
          data: { account_number: body.account_number, account_name: 'IT ORGANIZER ACCOUNT' },
        })
      : reply(400, { status: 'error', message: 'Sorry, recipient account could not be validated.' })
  }
  if (href.includes('flutterwave.com')) return reply(500, { status: 'error' })
  return reply(200, { id: 'run_fake' })
}) as typeof fetch
void realFetch

const { db, user, events, orders, payouts, payoutAccounts, payoutTransfers } =
  await import('@ticketur/db')
const { eq } = await import('drizzle-orm')
const { appRouter } = await import('./routers/_app')
const { createCallerFactory } = await import('./trpc')
const { issuePayoutCode, accountCodeContext, payoutCodeContext } = await import(
  './lib/payout-codes'
)
const { rateLimitStore } = await import('./lib/rate-limit')

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
    await check('requests are open for an organizer (manual or live mode)', () => {
      assert.ok(o1.mode === 'manual' || o1.mode === 'live')
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

    // ─── Phase 2: accounts, codes, requests, decisions ──────────────────────
    console.log('bank account')
    const resolved = await asOrg.org.payouts.resolveAccount({
      bankCode: '044',
      accountNumber: '0690000031',
    })
    await check('the account name comes from Flutterwave', () => {
      assert.equal(resolved.accountName, 'IT ORGANIZER ACCOUNT')
      assert.equal(resolved.bankName, 'Access Bank')
      assert.equal(resolved.accountNumberMasked, '••••0031')
    })
    await check('an account Flutterwave cannot find is refused', () =>
      rejects(
        () =>
          asOrg.org.payouts.resolveAccount({
            bankCode: '044',
            accountNumber: '0123456789',
          }),
        'BAD_REQUEST'
      )
    )
    await check('a bank not on the list is refused', () =>
      rejects(
        () =>
          asOrg.org.payouts.resolveAccount({
            bankCode: '999',
            accountNumber: '0690000031',
          }),
        'BAD_REQUEST'
      )
    )
    await asOrg.org.payouts.requestAccountCode({
      bankCode: '044',
      accountNumber: '0690000031',
    })
    await check('a wrong code does not save the account', () =>
      rejects(
        () =>
          asOrg.org.payouts.saveAccount({
            bankCode: '044',
            accountNumber: '0690000031',
            code: '000000',
          }),
        'BAD_REQUEST'
      )
    )
    // The real code only ever exists in the email; mint one the same way.
    let minute = 1
    const mint = async (purpose: 'add_account' | 'request_payout', context: string) => {
      const issued = await issuePayoutCode(tx, {
        userId: org.id,
        purpose,
        context,
        now: new Date(Date.now() + 61_000 * minute++),
      })
      assert.ok(issued.issued, 'test could mint a code')
      return issued.code
    }
    const accountCode = await mint('add_account', accountCodeContext('044', '0690000031'))
    await check('a code for a DIFFERENT account number is refused', () =>
      rejects(
        () =>
          asOrg.org.payouts.saveAccount({
            bankCode: '044',
            accountNumber: '0690000032',
            code: accountCode,
          }),
        'BAD_REQUEST'
      )
    )
    const saved = await asOrg.org.payouts.saveAccount({
      bankCode: '044',
      accountNumber: '0690000031',
      code: accountCode,
    })
    await check('the right code saves the account, usable in 24 hours', () => {
      assert.equal(saved?.accountName, 'IT ORGANIZER ACCOUNT')
      const hours = (saved!.usableFrom.getTime() - saved!.addedAt.getTime()) / 3_600_000
      assert.equal(hours, 24)
    })
    await check('a brand-new account cannot receive a withdrawal yet', () =>
      rejects(
        () => asOrg.org.payouts.requestPayoutCode({ amountMinor: 1_000_000 }),
        'PRECONDITION_FAILED'
      )
    )
    // Age the account past the cool-down.
    await tx
      .update(payoutAccounts)
      .set({ createdAt: new Date(Date.now() - 25 * 3_600_000) })
      .where(eq(payoutAccounts.organizerId, org.id))

    console.log('withdrawal request')
    await check('below the ₦1,000 minimum is refused', () =>
      rejects(() => asOrg.org.payouts.requestPayoutCode({ amountMinor: 99_900 }), 'BAD_REQUEST')
    )
    await check('kobo amounts are refused', () =>
      rejects(() => asOrg.org.payouts.requestPayoutCode({ amountMinor: 100_050 }), 'BAD_REQUEST')
    )
    await check('more than is withdrawable is refused', () =>
      rejects(
        () => asOrg.org.payouts.requestPayoutCode({ amountMinor: 17_760_100 }),
        'BAD_REQUEST'
      )
    )
    // That was five code requests in a minute (one for the account, four
    // refused withdrawals): the per-user brake now holds the sixth back.
    await check('a flood of code requests is held back', () =>
      rejects(
        () => asOrg.org.payouts.requestPayoutCode({ amountMinor: 5_000_000 }),
        'TOO_MANY_REQUESTS'
      )
    )
    rateLimitStore.reset()
    await asOrg.org.payouts.requestPayoutCode({ amountMinor: 5_000_000 })
    const account = (await asOrg.org.payouts.overview()).account!
    const codeFor = (amount: number) =>
      mint('request_payout', payoutCodeContext(amount, account.id))

    const code5k = await codeFor(5_000_000)
    await check('a code for ₦50,000 cannot withdraw ₦170,000', () =>
      rejects(
        () => asOrg.org.payouts.requestPayout({ amountMinor: 17_000_000, code: code5k }),
        'BAD_REQUEST'
      )
    )
    const asImpersonated = ctx(sessionFor(org, admin.id))
    await check('an admin impersonating the organizer cannot request', () =>
      rejects(
        () => asImpersonated.org.payouts.requestPayout({ amountMinor: 5_000_000, code: code5k }),
        'FORBIDDEN'
      )
    )
    const first = await asOrg.org.payouts.requestPayout({ amountMinor: 5_000_000, code: code5k })
    await check('the request is pending review and holds the amount', async () => {
      assert.equal(first.status, 'pending_review')
      const o = await asOrg.org.payouts.overview()
      assert.equal(o.summary.inProgressMinor, 5_000_000)
      assert.equal(o.hasOpenPayout, true)
    })
    await check('a spent code cannot be used again', () =>
      rejects(
        () => asOrg.org.payouts.requestPayout({ amountMinor: 5_000_000, code: code5k }),
        'BAD_REQUEST'
      )
    )
    await check('a second open request is refused', () =>
      rejects(
        () => asOrg.org.payouts.requestPayoutCode({ amountMinor: 1_000_000 }),
        'CONFLICT'
      )
    )

    console.log('admin decisions')
    const view = await asAdmin.admin.payouts.byId({ id: first.id })
    await check('the reviewer sees the name check, account age and actions', () => {
      assert.equal(view.nameMatch, 'match')
      assert.ok((view.accountAgeHours ?? 0) >= 24)
      assert.equal(view.covers, true)
      assert.equal(view.actions.canApprove, true)
      assert.equal(view.actions.canMarkPaid, false)
    })
    await asAdmin.admin.payouts.approve({ id: first.id })
    await check('the organizer can no longer cancel an approved request', () =>
      rejects(() => asOrg.org.payouts.cancel({ payoutId: first.id }), 'CONFLICT')
    )
    await check('approving twice is a conflict, not a second approval', () =>
      rejects(() => asAdmin.admin.payouts.approve({ id: first.id }), 'CONFLICT')
    )
    await asAdmin.admin.payouts.markPaid({ id: first.id, reference: 'FLW-DASH-123' })
    await check('marked paid by hand: paid out, with its history', async () => {
      const o = await asOrg.org.payouts.overview()
      assert.equal(o.summary.paidOutMinor, 5_000_000)
      assert.equal(o.summary.inProgressMinor, 0)
      const v = await asAdmin.admin.payouts.byId({ id: first.id })
      assert.equal(v.payout.method, 'manual')
      assert.equal(v.payout.manualReference, 'FLW-DASH-123')
      assert.deepEqual(
        v.history.map((h) => h.toStatus),
        ['pending_review', 'approved', 'paid']
      )
    })

    const second = await asOrg.org.payouts.requestPayout({
      amountMinor: 1_000_000,
      code: await codeFor(1_000_000),
    })
    await asAdmin.admin.payouts.reject({ id: second.id, reason: 'Bank details need checking' })
    await check('a rejection releases the amount and keeps the reason', async () => {
      const o = await asOrg.org.payouts.overview()
      assert.equal(o.summary.inProgressMinor, 0)
      const row = o.payouts.find((p) => p.id === second.id)
      assert.equal(row?.status, 'rejected')
      assert.equal(row?.note, 'Bank details need checking')
    })

    const third = await asOrg.org.payouts.requestPayout({
      amountMinor: 1_000_000,
      code: await codeFor(1_000_000),
    })
    await asOrg.org.payouts.cancel({ payoutId: third.id })
    await check('the organizer can cancel before review', async () => {
      const o = await asOrg.org.payouts.overview()
      assert.equal(o.payouts.find((p) => p.id === third.id)?.status, 'cancelled')
    })

    const fourth = await asOrg.org.payouts.requestPayout({
      amountMinor: 1_000_000,
      code: await codeFor(1_000_000),
    })
    // A refund lands after the request: the balance no longer covers it.
    await asAdmin.admin.payouts.addAdjustment({
      organizerId: org.id,
      kind: 'correction',
      direction: 'debit',
      amountMinor: 12_000_000,
      reason: 'Chargeback',
    })
    await check('approval re-checks the balance and refuses', () =>
      rejects(() => asAdmin.admin.payouts.approve({ id: fourth.id }), 'PRECONDITION_FAILED')
    )

    // An admin who is also the organizer of a payout cannot decide it.
    const selfPayout = id('pyt')
    await tx.insert(payouts).values({
      id: selfPayout,
      organizerId: admin.id,
      amountMinor: 100_000,
      bankCode: '044',
      bankName: 'Access Bank',
      accountNumber: '0690000031',
      accountName: 'IT ADMIN',
    })
    await check('an admin cannot approve their own withdrawal', () =>
      rejects(() => asAdmin.admin.payouts.approve({ id: selfPayout }), 'FORBIDDEN')
    )

    const queue = await asAdmin.admin.payouts.list({ status: 'needs_action' })
    await check('the queue lists what needs a person, oldest first', () => {
      const ids = queue.rows.map((r) => r.id)
      assert.ok(ids.includes(fourth.id))
      assert.ok(!ids.includes(first.id), 'paid is not in the queue')
    })

    // ─── Phase 3: live-mode actions (run the script with PAYOUTS_MODE=live) ──
    if (process.env.PAYOUTS_MODE === 'live') {
      console.log('live mode: retry and unconfirmed transfers')
      await asAdmin.admin.payouts.reject({ id: fourth.id, reason: 'clearing for the next checks' })
      // Undo the chargeback so the balance covers again.
      await asAdmin.admin.payouts.addAdjustment({
        organizerId: org.id,
        kind: 'correction',
        direction: 'credit',
        amountMinor: 12_000_000,
        reason: 'Chargeback reversed',
      })
      const snapshot = {
        organizerId: org.id,
        organizerName: 'IT Organizer',
        organizerEmail: org.email,
        bankCode: '044',
        bankName: 'Access Bank',
        accountNumber: '0690000031',
        accountName: 'IT ORGANIZER ACCOUNT',
      }

      const failedId = id('pyt')
      await tx.insert(payouts).values({ id: failedId, amountMinor: 1_000_000, status: 'failed', ...snapshot })
      await asAdmin.admin.payouts.retry({ id: failedId })
      await check('retry moves a failed payout back to approved, for the worker to send', async () => {
        const v = await asAdmin.admin.payouts.byId({ id: failedId })
        assert.equal(v.payout.status, 'approved')
      })
      await asAdmin.admin.payouts.reject({ id: failedId, reason: 'clearing' })

      const inFlight = id('pyt')
      const reference = `TKTP-${run}unconfirmed-1`
      await tx.insert(payouts).values({ id: inFlight, amountMinor: 1_000_000, status: 'processing', ...snapshot })
      await tx.insert(payoutTransfers).values({
        id: id('pytr'),
        payoutId: inFlight,
        attempt: 1,
        reference,
        status: 'unconfirmed',
        amountMinor: 1_000_000,
      })
      const v1 = await asAdmin.admin.payouts.byId({ id: inFlight })
      await check('an unconfirmed transfer offers "resolve", never retry or mark paid', () => {
        assert.equal(v1.actions.canResolveUnconfirmed, true)
        assert.equal(v1.actions.canRetry, false)
        assert.equal(v1.actions.canMarkPaid, false)
        assert.equal(v1.actions.canReject, false)
      })
      await check('resolving needs the reference typed back exactly', () =>
        rejects(
          () =>
            asAdmin.admin.payouts.resolveUnconfirmed({
              id: inFlight,
              outcome: 'not_sent',
              reference: 'TKTP-something-else',
            }),
          'BAD_REQUEST'
        )
      )
      await asAdmin.admin.payouts.resolveUnconfirmed({ id: inFlight, outcome: 'not_sent', reference })
      await check('"not sent" fails it, and only then can it be retried', async () => {
        const v = await asAdmin.admin.payouts.byId({ id: inFlight })
        assert.equal(v.payout.status, 'failed')
        assert.equal(v.transfers[0]?.status, 'failed')
        assert.equal(v.actions.canRetry, true)
      })
      await asAdmin.admin.payouts.reject({ id: inFlight, reason: 'clearing' })

      const inFlight2 = id('pyt')
      const reference2 = `TKTP-${run}unconfirmed-2`
      await tx.insert(payouts).values({ id: inFlight2, amountMinor: 1_000_000, status: 'processing', ...snapshot })
      await tx.insert(payoutTransfers).values({
        id: id('pytr'),
        payoutId: inFlight2,
        attempt: 1,
        reference: reference2,
        status: 'unconfirmed',
        amountMinor: 1_000_000,
      })
      await asAdmin.admin.payouts.resolveUnconfirmed({ id: inFlight2, outcome: 'paid', reference: reference2 })
      await check('"paid" settles it as a transfer', async () => {
        const v = await asAdmin.admin.payouts.byId({ id: inFlight2 })
        assert.equal(v.payout.status, 'paid')
        assert.equal(v.payout.method, 'transfer')
        assert.equal(v.transfers[0]?.status, 'successful')
      })
    }

    throw new Rollback()
  })
} catch (err) {
  if (!(err instanceof Rollback)) throw err
}

console.log(`\n${checks} checks passed; everything rolled back.`)
process.exit(0)

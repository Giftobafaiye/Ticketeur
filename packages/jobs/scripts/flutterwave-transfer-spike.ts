// Proves the Flutterwave v3 transfer contract this codebase relies on, against
// Flutterwave's TEST mode, before any real money is involved.
//
// Run from the repo root with a TEST secret key (it refuses a live one):
//
//   FLW_SECRET_KEY=FLWSECK_TEST-… \
//   node ./node_modules/.pnpm/tsx@4.23.15/node_modules/tsx/dist/cli.mjs \
//     packages/jobs/scripts/flutterwave-transfer-spike.ts
//
// It writes nothing anywhere except your terminal. Each step prints what
// Flutterwave answered, and the summary at the end lists the facts the payout
// code assumes, each marked CONFIRMED or DIFFERENT, so a surprise is visible
// before it is shipped.
//
// What it checks:
//   1. GET  /v3/banks/NG                  — the list organizers pick from
//   2. POST /v3/accounts/resolve          — name lookup on a test account
//   3. GET  /v3/transfers/fee             — the fee for a ₦5,000 transfer
//   4. GET  /v3/balances/NGN              — the test balance
//   5. POST /v3/transfers                 — a transfer that will SUCCEED
//   6. POST /v3/transfers, same reference — what a reused reference does
//   7. GET  /v3/transfers?reference=…     — whether lookup by reference works
//   8. POST /v3/transfers                 — a transfer that will FAIL
//   9. GET  /v3/transfers/:id, polled     — both reaching their final state
//
// Test mode decides a mocked transfer's outcome from the reference suffix
// (developer.flutterwave.com/docs/testing): `_PMCKDU_1` succeeds after one
// minute, `_PMCK_ST_FDU_1` fails after one minute. Flutterwave's testing page
// also says the calling server's IP must be whitelisted for transfers; if step
// 5 is refused for that reason, that is a finding in itself.
//
// If this machine's IP is not whitelisted the transfer steps report the
// refusal and the script carries on with what it can check.

const key = process.env.FLW_SECRET_KEY ?? ''
if (!key) {
  console.error('Set FLW_SECRET_KEY to a Flutterwave TEST secret key.')
  process.exit(1)
}
if (!key.includes('_TEST')) {
  console.error(
    'Refusing to run: FLW_SECRET_KEY is not a test key. This script sends transfers.'
  )
  process.exit(1)
}

// The transfer client imports nothing from the environment module, so no
// placeholders are needed for it.
const transfers = await import('../src/utils/flutterwave-transfers')

const BASE_URL = 'https://api.flutterwave.com/v3'
const opts = { secretKey: key }

type Finding = { fact: string; ok: boolean; detail: string }
const findings: Finding[] = []

function note(fact: string, ok: boolean, detail: string) {
  findings.push({ fact, ok, detail })
}

// A call that gets no answer is a finding, not a crash: it comes back as
// status 0 with the error as its message, and the steps carry on. `ms` shows
// how long Flutterwave took, since a slow endpoint is a finding too.
async function raw(path: string, init?: { method?: string; body?: unknown }) {
  const started = Date.now()
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(60_000),
    })
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
    return { status: res.status, json, ms: Date.now() - started }
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return { status: 0, json: { message } as Record<string, unknown>, ms: Date.now() - started }
  }
}

function show(step: string, value: unknown) {
  console.log(`\n── ${step}`)
  console.log(JSON.stringify(value, null, 2))
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// 1. Banks
{
  const res = await raw('/banks/NG')
  const data = Array.isArray(res.json?.data) ? (res.json!.data as unknown[]) : []
  const access = data.find(
    (b) => typeof b === 'object' && b !== null && (b as { code?: unknown }).code === '044'
  )
  show('1. GET /v3/banks/NG', {
    status: res.status,
    count: data.length,
    sample: data.slice(0, 3),
    accessBank: access ?? null,
  })
  note(
    'banks list is {status:"success", data:[{code,name}]} with Access Bank as "044"',
    res.status === 200 && data.length > 0 && Boolean(access),
    `HTTP ${res.status}, ${data.length} banks`
  )
}

// 2. Resolve a test account
{
  const res = await raw('/accounts/resolve', {
    method: 'POST',
    body: { account_number: '0690000031', account_bank: '044' },
  })
  show('2. POST /v3/accounts/resolve (0690000031 @ 044)', res)
  const name = (res.json?.data as { account_name?: unknown } | undefined)?.account_name
  note(
    'resolve returns data.account_name on 200',
    res.status === 200 && typeof name === 'string' && name.length > 0,
    `HTTP ${res.status}: ${String(res.json?.message ?? '')}`
  )
  const bad = await raw('/accounts/resolve', {
    method: 'POST',
    body: { account_number: '0000000000', account_bank: '044' },
  })
  show('2b. POST /v3/accounts/resolve (a number that should not resolve)', bad)
  note(
    'an unresolvable account is a 4xx with a message',
    bad.status >= 400 && bad.status < 500,
    `HTTP ${bad.status}: ${String(bad.json?.message ?? '')}`
  )
}

// 3. Fee
{
  const fee = await transfers.getTransferFee(500_000, opts)
  show('3. GET /v3/transfers/fee (₦5,000)', fee)
  note('fee endpoint answers with data[0].fee', fee.kind === 'found', JSON.stringify(fee))
}

// 4. Balance
{
  const balance = await transfers.getNgnBalance(opts)
  show('4. GET /v3/balances/NGN', balance)
  note(
    'balance endpoint answers with data.available_balance',
    balance.kind === 'found',
    JSON.stringify(balance)
  )
}

// 5–9. Transfers
const stamp = Date.now().toString(36)
const okRef = `TKTP-SPIKE-${stamp}-1_PMCKDU_1`
const failRef = `TKTP-SPIKE-${stamp}-2_PMCK_ST_FDU_1`
const input = {
  bankCode: '044',
  accountNumber: '0690000040',
  amountMinor: 500_000,
  narration: 'Ticketeur payout spike',
}

const first = await transfers.createTransfer({ ...input, reference: okRef }, opts)
show('5. POST /v3/transfers (will succeed)', first)
note(
  'a transfer is accepted with data.id and an initial status',
  first.kind === 'accepted',
  JSON.stringify(first)
)
if (first.kind === 'accepted') {
  note(
    'the initial status is NEW or PENDING',
    ['NEW', 'PENDING'].includes(first.transfer.status),
    first.transfer.status
  )
}

const again = await transfers.createTransfer({ ...input, reference: okRef }, opts)
show('6. POST /v3/transfers again, SAME reference', again)
// Must classify as duplicate_reference: a plain 'refused' would make the
// engine mark the payout failed while the first transfer can still complete.
note(
  'a reused reference is read as a duplicate (no second transfer, not a failure)',
  again.kind === 'duplicate_reference',
  JSON.stringify(again)
)

const byRef = await transfers.findTransferByReference(okRef, opts)
show('7. GET /v3/transfers?reference=…', byRef)
note(
  'lookup by reference finds the transfer',
  byRef.kind === 'found',
  JSON.stringify(byRef)
)

const failing = await transfers.createTransfer({ ...input, reference: failRef }, opts)
show('8. POST /v3/transfers (will fail)', failing)

if (first.kind === 'accepted' || failing.kind === 'accepted') {
  console.log('\nWaiting ~75 seconds for the mocked transfers to settle…')
  await sleep(75_000)
  for (const [label, outcome, expect] of [
    ['success', first, 'SUCCESSFUL'],
    ['failure', failing, 'FAILED'],
  ] as const) {
    if (outcome.kind !== 'accepted') continue
    const now = await transfers.getTransfer(outcome.transfer.id, opts)
    show(`9. GET /v3/transfers/${outcome.transfer.id} (${label})`, now)
    note(
      `a mocked ${label} ends ${expect}`,
      now.kind === 'found' && now.transfer.status === expect,
      JSON.stringify(now)
    )
  }
}

console.log('\n══ Summary ══')
for (const f of findings) {
  console.log(`${f.ok ? 'CONFIRMED' : 'DIFFERENT'}  ${f.fact}\n           ${f.detail}`)
}

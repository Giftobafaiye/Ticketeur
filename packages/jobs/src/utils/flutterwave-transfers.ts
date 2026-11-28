// Flutterwave v3 transfers: sending an organizer's payout to their bank, and
// finding out what happened to it.
//
//   POST /v3/transfers                 — send one transfer
//   GET  /v3/transfers/:id             — one transfer's current state
//   GET  /v3/transfers?reference=…     — find a transfer by OUR reference
//   GET  /v3/balances/NGN              — what the platform can pay out right now
//   GET  /v3/transfers/fee             — what one transfer costs
//
// This lives in the Trigger.dev worker, not in @ticketur/api, for one reason:
// Flutterwave only accepts transfer calls from whitelisted server addresses,
// and the worker is where a fixed address can come from (Trigger.dev static
// IPs). Vercel functions have no fixed outbound address.
//
// No env import: the caller passes the secret key, so the module loads under
// `node --test` with no environment and the tests can answer for Flutterwave.
//
// ── The one rule ──
// A transfer whose outcome we do not KNOW is never sent again. The create call
// can time out after Flutterwave has accepted it; sending again would pay the
// organizer twice. So the answer to every create call is classified into one
// of four outcomes, and only `refused` — Flutterwave said no before anything
// was created — frees the payout for another attempt. `ambiguous` is settled
// by looking the reference up, never by retrying. This is the same reasoning
// as the email fallback in ./email.ts: refusals are safe to route around,
// ambiguous failures are not.
//
// ── What is and is not verified ──
// Field names follow Flutterwave's v3 reference; they have not been run
// against the live API from this codebase yet (packages/jobs/scripts/
// flutterwave-transfer-spike.ts does that, with a test key). Every parser
// therefore treats an unrecognised body as "no usable answer".

const BASE_URL = 'https://api.flutterwave.com/v3'
const TIMEOUT_MS = 20_000

export type CallOptions = {
  secretKey: string | undefined
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}

export type FlutterwaveTransfer = {
  // Flutterwave's id, as text: it arrives as a number and is stored as text.
  id: string
  reference: string
  // Upper-cased: NEW, PENDING, SUCCESSFUL, FAILED.
  status: string
  amountMinor: number | null
  feeMinor: number | null
  currency: string
  completeMessage: string
  // Set when the Flutterwave account holds API transfers for approval in the
  // dashboard. The transfer then sits in NEW until someone approves it there.
  requiresApproval: boolean
}

export type TransferState = 'pending' | 'successful' | 'failed'

export type CreateTransferOutcome =
  // Flutterwave took it. Its final state arrives later (webhook, or a lookup).
  | { kind: 'accepted'; transfer: FlutterwaveTransfer }
  // Flutterwave says this reference was used before: an earlier attempt that
  // we thought had failed in transit did arrive. Look it up; do not resend.
  | { kind: 'duplicate_reference'; message: string }
  // Flutterwave said no before creating anything: bad account, insufficient
  // balance, a non-whitelisted address, a bad key. Safe to try again later
  // once the cause is fixed.
  | { kind: 'refused'; httpStatus: number; message: string }
  // No answer we can trust: timeout, network, 5xx, unreadable body. The
  // transfer may or may not exist.
  | { kind: 'ambiguous'; reason: string }

export type TransferLookup =
  | { kind: 'found'; transfer: FlutterwaveTransfer }
  // Flutterwave answered, and has no such transfer.
  | { kind: 'none' }
  | { kind: 'unauthorized'; httpStatus: number }
  | { kind: 'unavailable'; reason: string }

export type BalanceLookup =
  | { kind: 'found'; availableMinor: number; ledgerMinor: number | null }
  | { kind: 'unauthorized'; httpStatus: number }
  | { kind: 'unavailable'; reason: string }

export type FeeLookup =
  | { kind: 'found'; feeMinor: number }
  | { kind: 'unavailable'; reason: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function messageOf(json: unknown): string {
  return isRecord(json) && typeof json.message === 'string'
    ? json.message.trim()
    : ''
}

function toMinor(value: unknown): number | null {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN
  return Number.isFinite(n) ? Math.round(n * 100) : null
}

/** A test-mode secret key. Flutterwave prefixes them `FLWSECK_TEST-`. */
export function isTestSecretKey(key: string | undefined): boolean {
  return typeof key === 'string' && key.includes('_TEST')
}

/**
 * Where a Flutterwave status leaves the transfer. Only SUCCESSFUL means the
 * money went; only FAILED means it did not. Anything else (NEW, PENDING, a
 * status this code has never seen) is still in flight and is checked again
 * later, which is the safe reading of a word we do not know.
 */
export function transferState(status: string): TransferState {
  const s = status.trim().toUpperCase()
  if (s === 'SUCCESSFUL') return 'successful'
  if (s === 'FAILED') return 'failed'
  return 'pending'
}

/** A transfer record out of a Flutterwave `data` object, or null. */
export function parseTransfer(data: unknown): FlutterwaveTransfer | null {
  if (!isRecord(data)) return null
  const id =
    typeof data.id === 'number' || typeof data.id === 'string'
      ? String(data.id).trim()
      : ''
  const reference =
    typeof data.reference === 'string' ? data.reference.trim() : ''
  const status = typeof data.status === 'string' ? data.status.trim() : ''
  if (!id || !reference || !status) return null
  return {
    id,
    reference,
    status: status.toUpperCase(),
    amountMinor: toMinor(data.amount),
    feeMinor: toMinor(data.fee),
    currency: typeof data.currency === 'string' ? data.currency : 'NGN',
    completeMessage:
      typeof data.complete_message === 'string'
        ? data.complete_message.trim()
        : '',
    requiresApproval:
      data.requires_approval === 1 || data.requires_approval === true,
  }
}

// Flutterwave's sandbox answers a reused reference with HTTP 400 "Payout with
// this ref already exists" (seen 2026-11-28), so "ref" has to count as well as
// "reference". Reading it as a plain refusal would mark the payout failed
// while the original transfer can still complete, and a retry would pay twice.
function looksLikeDuplicateReference(message: string): boolean {
  return (
    /\bref(erence)?s?\b/i.test(message) &&
    /(duplicate|already|exist)/i.test(message)
  )
}

/**
 * What a POST /v3/transfers response means. Pure, so every branch is tested.
 *
 * The line that matters is between `refused` and `ambiguous`. A 4xx is a
 * refusal: Flutterwave read the request and turned it down, so nothing was
 * created. A 5xx, a 408 or a 2xx we cannot read may have been accepted, so it
 * is ambiguous and must be looked up rather than retried.
 */
export function classifyCreateTransfer(
  httpStatus: number,
  json: unknown
): CreateTransferOutcome {
  if (httpStatus >= 200 && httpStatus < 300) {
    if (isRecord(json) && json.status === 'success') {
      const transfer = parseTransfer(json.data)
      if (transfer) return { kind: 'accepted', transfer }
    }
    return {
      kind: 'ambiguous',
      reason: `HTTP ${httpStatus} with a body that does not describe a transfer`,
    }
  }
  if (httpStatus === 408) {
    return { kind: 'ambiguous', reason: 'HTTP 408' }
  }
  const message = messageOf(json)
  if (httpStatus === 409 || looksLikeDuplicateReference(message)) {
    return {
      kind: 'duplicate_reference',
      message: message || `HTTP ${httpStatus}`,
    }
  }
  if (httpStatus >= 400 && httpStatus < 500) {
    return {
      kind: 'refused',
      httpStatus,
      message: message || `HTTP ${httpStatus}`,
    }
  }
  return { kind: 'ambiguous', reason: `HTTP ${httpStatus}` }
}

/**
 * The transfer with exactly `reference` out of a GET /v3/transfers body.
 *
 * Matches the reference exactly, client side, rather than trusting the query
 * filter: if Flutterwave ignored `?reference=` the page holds other transfers,
 * and the absence of ours from one page proves nothing — that is
 * `unavailable`, not `none`. Only an empty, successful list is `none`.
 */
export function pickTransferByReference(
  httpStatus: number,
  json: unknown,
  reference: string
): TransferLookup {
  if (httpStatus === 401 || httpStatus === 403) {
    return { kind: 'unauthorized', httpStatus }
  }
  if (
    httpStatus !== 200 ||
    !isRecord(json) ||
    json.status !== 'success' ||
    !Array.isArray(json.data)
  ) {
    return { kind: 'unavailable', reason: `HTTP ${httpStatus}` }
  }
  for (const entry of json.data) {
    const transfer = parseTransfer(entry)
    if (transfer && transfer.reference === reference) {
      return { kind: 'found', transfer }
    }
  }
  if (json.data.length === 0) return { kind: 'none' }
  return {
    kind: 'unavailable',
    reason: 'the list did not filter by reference, and ours was not on it',
  }
}

async function callFlutterwave(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
  opts: CallOptions
): Promise<
  { ok: true; status: number; json: unknown } | { ok: false; reason: string }
> {
  if (!opts.secretKey) {
    return { ok: false, reason: 'FLW_SECRET_KEY is not configured' }
  }
  const fetchImpl = opts.fetchImpl ?? fetch
  let res: Response
  try {
    res = await fetchImpl(`${BASE_URL}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${opts.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: opts.signal ?? AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    }
  }
  const json = (await res.json().catch(() => null)) as unknown
  return { ok: true, status: res.status, json }
}

export type CreateTransferInput = {
  reference: string
  bankCode: string
  accountNumber: string
  // Kobo. Payouts are whole naira (a CHECK on `payouts` says so), and
  // Flutterwave takes major units, so this divides exactly.
  amountMinor: number
  narration: string
}

/**
 * POST /v3/transfers. Never throws: every failure is one of the outcomes
 * above, and a thrown fetch is `ambiguous` (it may have reached Flutterwave).
 */
export async function createTransfer(
  input: CreateTransferInput,
  opts: CallOptions
): Promise<CreateTransferOutcome> {
  if (!opts.secretKey) {
    // Nothing was sent, so this is a refusal, not an ambiguity.
    return {
      kind: 'refused',
      httpStatus: 0,
      message: 'FLW_SECRET_KEY is not configured',
    }
  }
  const res = await callFlutterwave(
    '/transfers',
    {
      method: 'POST',
      body: {
        account_bank: input.bankCode,
        account_number: input.accountNumber,
        amount: input.amountMinor / 100,
        narration: input.narration,
        currency: 'NGN',
        debit_currency: 'NGN',
        reference: input.reference,
      },
    },
    opts
  )
  if (!res.ok) return { kind: 'ambiguous', reason: res.reason }
  return classifyCreateTransfer(res.status, res.json)
}

/** GET /v3/transfers/:id. */
export async function getTransfer(
  id: string,
  opts: CallOptions
): Promise<TransferLookup> {
  const res = await callFlutterwave(
    `/transfers/${encodeURIComponent(id)}`,
    { method: 'GET' },
    opts
  )
  if (!res.ok) return { kind: 'unavailable', reason: res.reason }
  if (res.status === 401 || res.status === 403) {
    return { kind: 'unauthorized', httpStatus: res.status }
  }
  if (res.status === 404) return { kind: 'none' }
  if (res.status === 200 && isRecord(res.json) && res.json.status === 'success') {
    const transfer = parseTransfer(res.json.data)
    if (transfer) return { kind: 'found', transfer }
  }
  return { kind: 'unavailable', reason: `HTTP ${res.status}` }
}

/** GET /v3/transfers?reference=… — see pickTransferByReference. */
export async function findTransferByReference(
  reference: string,
  opts: CallOptions
): Promise<TransferLookup> {
  const query = new URLSearchParams({ reference })
  const res = await callFlutterwave(
    `/transfers?${query}`,
    { method: 'GET' },
    opts
  )
  if (!res.ok) return { kind: 'unavailable', reason: res.reason }
  return pickTransferByReference(res.status, res.json, reference)
}

/** GET /v3/balances/NGN — the platform's spendable naira. */
export async function getNgnBalance(opts: CallOptions): Promise<BalanceLookup> {
  const res = await callFlutterwave('/balances/NGN', { method: 'GET' }, opts)
  if (!res.ok) return { kind: 'unavailable', reason: res.reason }
  if (res.status === 401 || res.status === 403) {
    return { kind: 'unauthorized', httpStatus: res.status }
  }
  if (
    res.status === 200 &&
    isRecord(res.json) &&
    res.json.status === 'success' &&
    isRecord(res.json.data)
  ) {
    const available = toMinor(res.json.data.available_balance)
    if (available !== null) {
      return {
        kind: 'found',
        availableMinor: available,
        ledgerMinor: toMinor(res.json.data.ledger_balance),
      }
    }
  }
  return { kind: 'unavailable', reason: `HTTP ${res.status}` }
}

/** GET /v3/transfers/fee — Flutterwave's charge for one NGN bank transfer. */
export async function getTransferFee(
  amountMinor: number,
  opts: CallOptions
): Promise<FeeLookup> {
  const query = new URLSearchParams({
    amount: String(amountMinor / 100),
    currency: 'NGN',
    type: 'account',
  })
  const res = await callFlutterwave(
    `/transfers/fee?${query}`,
    { method: 'GET' },
    opts
  )
  if (!res.ok) return { kind: 'unavailable', reason: res.reason }
  if (res.status === 200 && isRecord(res.json) && res.json.status === 'success') {
    const data = res.json.data
    const first = Array.isArray(data) ? data[0] : data
    if (isRecord(first)) {
      const fee = toMinor(first.fee)
      if (fee !== null) return { kind: 'found', feeMinor: fee }
    }
  }
  return { kind: 'unavailable', reason: `HTTP ${res.status}` }
}

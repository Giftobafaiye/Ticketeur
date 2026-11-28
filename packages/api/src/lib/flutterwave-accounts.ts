// Bank accounts through Flutterwave v3: the list of Nigerian banks an organizer
// picks from, and the name lookup that proves an account number is real before
// it can receive a payout (routers/org/payouts.ts).
//
//   GET  /v3/banks/NG          — every bank, each with the `code` transfers use
//   POST /v3/accounts/resolve  — account_number + account_bank → account_name
//
// No env import, on purpose: the caller passes the secret key in. That keeps
// this module loadable by `node --test` with no environment at all, and keeps
// the one place that reads FLW_SECRET_KEY for these calls (the router) easy to
// find.
//
// ── What is and is not verified ──
// The shapes below follow Flutterwave's v3 reference. They have not yet been
// run against the live API from this codebase — that is what
// packages/jobs/scripts/flutterwave-transfer-spike.ts is for — so every parser
// treats a body it does not recognise as "no usable answer", never as a result.
// The failure mode of a wrong guess is "please try again", not a wrong name.

const BASE_URL = 'https://api.flutterwave.com/v3'

// Long enough for a slow bank switch, short enough that an organizer staring
// at a spinner is told something within one breath.
const TIMEOUT_MS = 15_000

export type FlutterwaveBank = {
  // What transfers and the resolve call take as `account_bank`, e.g. "044".
  code: string
  name: string
}

export type BankListResult =
  | { kind: 'found'; banks: FlutterwaveBank[] }
  | { kind: 'unauthorized'; httpStatus: number }
  | { kind: 'unavailable'; reason: string }

export type AccountResolution =
  // Flutterwave matched the number at that bank and named the holder.
  | { kind: 'resolved'; accountNumber: string; accountName: string }
  // Flutterwave answered, and the answer is that this number does not resolve
  // at this bank: a typo, the wrong bank, a closed account.
  | { kind: 'not_found'; message: string }
  // Our key (or this server's address) was refused. Every lookup will fail the
  // same way until someone fixes the configuration.
  | { kind: 'unauthorized'; httpStatus: number }
  // No usable answer: network, timeout, rate limit, 5xx, a body we could not
  // read. Says nothing about the account.
  | { kind: 'unavailable'; reason: string }

type CallOptions = {
  secretKey: string | undefined
  // Injectable so the tests can answer for Flutterwave.
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function messageOf(json: unknown): string {
  return isRecord(json) && typeof json.message === 'string'
    ? json.message.trim()
    : ''
}

function describeError(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err)
}

/**
 * A holder's name as banks print it, tidied for display and comparison:
 * runs of whitespace collapsed, ends trimmed. Case is left alone — banks
 * return upper case and that is what the organizer will recognise.
 */
export function normalizeAccountName(name: string): string {
  return name.replace(/\s+/g, ' ').trim()
}

/**
 * The bank list out of a GET /v3/banks/NG body, or null when the body is not
 * the shape Flutterwave documents. De-duplicated by code (the first name
 * wins) and sorted by name, because the list is shown to people.
 */
export function parseBankList(json: unknown): FlutterwaveBank[] | null {
  if (!isRecord(json) || json.status !== 'success' || !Array.isArray(json.data))
    return null
  const byCode = new Map<string, FlutterwaveBank>()
  for (const entry of json.data) {
    if (!isRecord(entry)) continue
    const rawCode = entry.code
    const code =
      typeof rawCode === 'string'
        ? rawCode.trim()
        : typeof rawCode === 'number'
          ? String(rawCode)
          : ''
    const name = typeof entry.name === 'string' ? entry.name.trim() : ''
    if (!code || !name || byCode.has(code)) continue
    byCode.set(code, { code, name })
  }
  if (byCode.size === 0) return null
  return [...byCode.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
  )
}

/**
 * What a POST /v3/accounts/resolve response means.
 *
 * Only a 2xx carrying a non-empty `data.account_name` is a resolution. A 4xx
 * that Flutterwave explains is `not_found`, because that is overwhelmingly
 * what it is (a mistyped number, the wrong bank), and the organizer can act on
 * it. 401/403 are configuration. Everything else is `unavailable`, which the
 * organizer is told to retry and which never turns into a "no".
 */
export function parseAccountResolution(
  httpStatus: number,
  json: unknown,
  requestedNumber: string
): AccountResolution {
  if (httpStatus === 401 || httpStatus === 403) {
    return { kind: 'unauthorized', httpStatus }
  }
  if (httpStatus >= 200 && httpStatus < 300) {
    if (
      isRecord(json) &&
      json.status === 'success' &&
      isRecord(json.data) &&
      typeof json.data.account_name === 'string'
    ) {
      const accountName = normalizeAccountName(json.data.account_name)
      if (accountName) {
        const echoed = json.data.account_number
        return {
          kind: 'resolved',
          accountNumber:
            typeof echoed === 'string' && echoed.trim()
              ? echoed.trim()
              : requestedNumber,
          accountName,
        }
      }
    }
    return {
      kind: 'unavailable',
      reason: `HTTP ${httpStatus} without an account name`,
    }
  }
  if (httpStatus === 429 || httpStatus === 408) {
    return { kind: 'unavailable', reason: `HTTP ${httpStatus}` }
  }
  if (httpStatus >= 400 && httpStatus < 500) {
    return {
      kind: 'not_found',
      message: messageOf(json) || 'The account could not be verified.',
    }
  }
  return { kind: 'unavailable', reason: `HTTP ${httpStatus}` }
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
    return { ok: false, reason: describeError(err) }
  }
  const json = (await res.json().catch(() => null)) as unknown
  return { ok: true, status: res.status, json }
}

/** GET /v3/banks/NG. */
export async function listBanks(opts: CallOptions): Promise<BankListResult> {
  const res = await callFlutterwave('/banks/NG', { method: 'GET' }, opts)
  if (!res.ok) return { kind: 'unavailable', reason: res.reason }
  if (res.status === 401 || res.status === 403) {
    return { kind: 'unauthorized', httpStatus: res.status }
  }
  const banks = res.status === 200 ? parseBankList(res.json) : null
  return banks
    ? { kind: 'found', banks }
    : { kind: 'unavailable', reason: `HTTP ${res.status}` }
}

/** POST /v3/accounts/resolve. */
export async function resolveBankAccount(
  args: { accountNumber: string; bankCode: string } & CallOptions
): Promise<AccountResolution> {
  const res = await callFlutterwave(
    '/accounts/resolve',
    {
      method: 'POST',
      body: {
        account_number: args.accountNumber,
        account_bank: args.bankCode,
      },
    },
    args
  )
  if (!res.ok) return { kind: 'unavailable', reason: res.reason }
  return parseAccountResolution(res.status, res.json, args.accountNumber)
}

// ─── The bank list, cached ──────────────────────────────────────────────────
//
// The list changes a few times a year and is asked for on every visit to the
// payouts page, so each server instance keeps the last good copy for six
// hours. On serverless that is per instance, which is fine: the cost of a cold
// instance is one extra GET. A failed refresh serves the stale copy rather
// than an empty picker.

const BANK_LIST_TTL_MS = 6 * 60 * 60 * 1000

let bankListCache: { at: number; banks: FlutterwaveBank[] } | null = null

export async function getBanksCached(
  opts: CallOptions & { now?: number }
): Promise<BankListResult> {
  const now = opts.now ?? Date.now()
  if (bankListCache && now - bankListCache.at < BANK_LIST_TTL_MS) {
    return { kind: 'found', banks: bankListCache.banks }
  }
  const fresh = await listBanks(opts)
  if (fresh.kind === 'found') {
    bankListCache = { at: now, banks: fresh.banks }
    return fresh
  }
  if (bankListCache) return { kind: 'found', banks: bankListCache.banks }
  return fresh
}

/** Tests only: forget the cached list. */
export function resetBankListCache(): void {
  bankListCache = null
}

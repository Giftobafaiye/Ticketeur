import {
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto'
import { promisify } from 'node:util'

import { and, desc, eq, gt, isNull, lt, sql } from 'drizzle-orm'

import { payoutCodes, type PayoutCodePurpose } from '@ticketur/db'
import {
  newPayoutRowId,
  type DbExecutor,
  type DbTransaction,
} from '@ticketur/db/payouts'

// The emailed code an organizer types to add a bank account or to ask for a
// withdrawal. It proves the person at the keyboard can read the account's
// inbox, so a stolen session alone cannot redirect or withdraw money.
//
// Modelled on lib/vote-otp.ts, with the one thing that module could not have:
// the digest binds the PURPOSE and the exact ACTION. A code sent for "add
// Access Bank ••••0031" cannot be spent on adding a different account, and a
// code sent for "withdraw ₦50,000" cannot be spent on ₦500,000. The bound
// action is the `context` string the caller builds with the helpers below.
//
// ── Where each guarantee lives ──
//   not recoverable from the database → scrypt digest, per-row salt
//   not brute-forceable → an attempt is CLAIMED by a conditional UPDATE
//     before the comparison, so the database decides whether a guess is
//     affordable (verifyPayoutCode)
//   used once → consumePayoutCode, inside the caller's transaction
//   not a mailer → issuePayoutCode's cooldown and hourly ceiling

export const PAYOUT_CODE_LENGTH = 6
export const PAYOUT_CODE_TTL_MS = 10 * 60 * 1000
export const PAYOUT_CODE_TTL_MINUTES = PAYOUT_CODE_TTL_MS / 60_000
/** Guesses a code is worth; a right guess costs one too. */
export const MAX_VERIFY_ATTEMPTS = 5
export const REQUEST_COOLDOWN_MS = 60 * 1000
export const REQUEST_WINDOW_MS = 60 * 60 * 1000
export const MAX_REQUESTS_PER_WINDOW = 5

/** The action a bank-account code authorises. */
export function accountCodeContext(bankCode: string, accountNumber: string) {
  return `account:${bankCode}:${accountNumber}`
}

/** The action a withdrawal code authorises: this amount, to this account. */
export function payoutCodeContext(amountMinor: number, accountId: string) {
  return `payout:${amountMinor}:${accountId}`
}

// ─── Hashing ────────────────────────────────────────────────────────────────

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number }
) => Promise<Buffer>

const SCRYPT_N = 16_384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_BYTES = 32
const SALT_BYTES = 16
const SCHEME = 'scrypt'

type CodeArgs = {
  userId: string
  purpose: PayoutCodePurpose
  context: string
  code: string
}

function preimage(a: CodeArgs): string {
  return `${a.userId}\u0000${a.purpose}\u0000${a.context}\u0000${a.code}`
}

/** Six digits from the CSPRNG, leading zeros kept. */
export function generatePayoutCode(): string {
  return String(randomInt(0, 10 ** PAYOUT_CODE_LENGTH)).padStart(
    PAYOUT_CODE_LENGTH,
    '0'
  )
}

export async function hashPayoutCode(args: CodeArgs): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const derived = await scrypt(preimage(args), salt, KEY_BYTES, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })
  return [
    SCHEME,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$')
}

/**
 * Whether `code`, for this user, purpose and action, is the one `stored` was
 * written from. Constant-time in the digest; a malformed digest is `false`,
 * never a throw. Parameters read from the row are bounded before scrypt sees
 * them, so a tampered row cannot make one check allocate gigabytes.
 */
export async function payoutCodeMatches(
  stored: string,
  args: CodeArgs
): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6) return false
  const [scheme, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ]
  if (scheme !== SCHEME) return false
  const N = Number(nRaw)
  const r = Number(rRaw)
  const p = Number(pRaw)
  if (
    !Number.isSafeInteger(N) ||
    !Number.isSafeInteger(r) ||
    !Number.isSafeInteger(p) ||
    N < 1024 ||
    N > SCRYPT_N ||
    r < 1 ||
    r > 16 ||
    p < 1 ||
    p > 4
  ) {
    return false
  }
  try {
    const expected = Buffer.from(hashRaw, 'base64url')
    const salt = Buffer.from(saltRaw, 'base64url')
    if (expected.length === 0 || salt.length === 0) return false
    const actual = await scrypt(preimage(args), salt, expected.length, {
      N,
      r,
      p,
    })
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

// ─── Issuing ────────────────────────────────────────────────────────────────

export type IssuePayoutCodeResult =
  | { issued: true; code: string; expiresAt: Date }
  | {
      issued: false
      reason: 'cooldown' | 'too_many'
      retryAfterSeconds: number
    }

function secondsUntil(target: number, now: number): number {
  return Math.max(1, Math.ceil((target - now) / 1000))
}

/**
 * Mint a code for (user, purpose, action) and store its digest. Refuses
 * within a minute of the last one, and past five an hour, per user and
 * purpose. Earlier live codes stay valid (a slow email is not punished), and
 * the guess budget does not grow by holding several: a wrong guess is charged
 * against every live code at once.
 */
export async function issuePayoutCode(
  db: DbExecutor,
  args: {
    userId: string
    purpose: PayoutCodePurpose
    context: string
    now?: Date
  }
): Promise<IssuePayoutCodeResult> {
  const now = args.now ?? new Date()
  const windowStart = new Date(now.getTime() - REQUEST_WINDOW_MS)
  const recent = await db
    .select({ createdAt: payoutCodes.createdAt })
    .from(payoutCodes)
    .where(
      and(
        eq(payoutCodes.userId, args.userId),
        eq(payoutCodes.purpose, args.purpose),
        gt(payoutCodes.createdAt, windowStart)
      )
    )
    .orderBy(desc(payoutCodes.createdAt))
    .limit(MAX_REQUESTS_PER_WINDOW)

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = recent[recent.length - 1]!.createdAt.getTime()
    return {
      issued: false,
      reason: 'too_many',
      retryAfterSeconds: secondsUntil(oldest + REQUEST_WINDOW_MS, now.getTime()),
    }
  }
  const newest = recent[0]
  if (newest) {
    const readyAt = newest.createdAt.getTime() + REQUEST_COOLDOWN_MS
    if (readyAt > now.getTime()) {
      return {
        issued: false,
        reason: 'cooldown',
        retryAfterSeconds: secondsUntil(readyAt, now.getTime()),
      }
    }
  }

  const code = generatePayoutCode()
  const expiresAt = new Date(now.getTime() + PAYOUT_CODE_TTL_MS)
  await db.insert(payoutCodes).values({
    id: newPayoutRowId('pyc'),
    userId: args.userId,
    purpose: args.purpose,
    codeHash: await hashPayoutCode({ ...args, code }),
    expiresAt,
    attempts: 0,
    consumedAt: null,
    createdAt: now,
  })
  return { issued: true, code, expiresAt }
}

// ─── Verifying and consuming ────────────────────────────────────────────────

export type VerifyPayoutCodeResult =
  | { ok: true; codeId: string }
  | { ok: false; reason: 'wrong' | 'expired_or_used' }

/**
 * Check a code, spending one attempt of every live code for this user and
 * purpose FIRST, in one statement, so concurrent guesses serialise on the
 * rows and only MAX_VERIFY_ATTEMPTS of them ever reach a comparison.
 *
 * MUST run on the pooled client, never inside the caller's transaction: the
 * attempt has to survive a refused action, or a guesser would get the budget
 * back every time the action failed.
 */
export async function verifyPayoutCode(
  db: DbExecutor,
  args: CodeArgs & { now?: Date }
): Promise<VerifyPayoutCodeResult> {
  const now = args.now ?? new Date()
  const code = args.code.trim()
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: 'wrong' }

  const claimed = await db
    .update(payoutCodes)
    .set({ attempts: sql`${payoutCodes.attempts} + 1` })
    .where(
      and(
        eq(payoutCodes.userId, args.userId),
        eq(payoutCodes.purpose, args.purpose),
        isNull(payoutCodes.consumedAt),
        gt(payoutCodes.expiresAt, now),
        lt(payoutCodes.attempts, MAX_VERIFY_ATTEMPTS)
      )
    )
    .returning({ id: payoutCodes.id, codeHash: payoutCodes.codeHash })

  if (claimed.length === 0) return { ok: false, reason: 'expired_or_used' }
  for (const row of claimed.slice(0, MAX_REQUESTS_PER_WINDOW)) {
    if (await payoutCodeMatches(row.codeHash, { ...args, code })) {
      return { ok: true, codeId: row.id }
    }
  }
  return { ok: false, reason: 'wrong' }
}

/**
 * Spend the code, inside the transaction the action commits in, so a refused
 * action leaves the organizer holding a code they can still use. `false`
 * means another request spent it first: refuse the action.
 */
export async function consumePayoutCode(
  tx: DbTransaction,
  args: { codeId: string; now?: Date }
): Promise<boolean> {
  const now = args.now ?? new Date()
  const spent = await tx
    .update(payoutCodes)
    .set({ consumedAt: now })
    .where(
      and(
        eq(payoutCodes.id, args.codeId),
        isNull(payoutCodes.consumedAt),
        gt(payoutCodes.expiresAt, now)
      )
    )
    .returning({ id: payoutCodes.id })
  return spent.length > 0
}

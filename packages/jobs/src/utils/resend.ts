import { Resend, type CreateEmailOptions } from 'resend'
import { env } from '@ticketur/env/core'

// Deliberately not exported. Everything goes through sendEmail in ./email.ts,
// which is where the Brevo fallback lives — a module reaching for this client
// directly would silently lose it.
const resend = new Resend(env.RESEND_API_KEY)

/**
 * The Resend refusals that mean *nothing was sent and sending again right now
 * will fail the same way*. All three are returned before the message leaves, so
 * a caller seeing one of these can safely hand the message to another provider
 * without risking a duplicate.
 *
 * - rate_limit_exceeded   too many requests per second
 * - daily_quota_exceeded  the free plan's ~200/day ceiling
 * - monthly_quota_exceeded the plan's monthly ceiling
 *
 * Deliberately NOT in this set: 5xx, network failures and timeouts. Those are
 * ambiguous — Resend may have accepted the message before the connection died —
 * and the retry safety there comes from the idempotency key, which only works
 * against Resend itself.
 */
const CAPACITY_ERRORS = new Set([
  'rate_limit_exceeded',
  'daily_quota_exceeded',
  'monthly_quota_exceeded',
])

export function isResendCapacityError(name: string | undefined): boolean {
  return name !== undefined && CAPACITY_ERRORS.has(name)
}

export type ResendOutcome =
  | { ok: true; id: string }
  | { ok: false; name: string; message: string; capacity: boolean }

/**
 * Resend reports API failures (rejected send, invalid key, rate limit) in the
 * returned result rather than by throwing, so a caller that ignores the result
 * treats a failed send as success and never retries it.
 *
 * The idempotency key makes Trigger.dev's retries safe: it is stable across the
 * attempts of one run, so a retry after an ambiguous network failure cannot
 * deliver the same message twice, while a later run (a genuine resend) carries
 * a different key and still sends.
 */
export async function sendViaResend(
  payload: CreateEmailOptions,
  idempotencyKey: string
): Promise<ResendOutcome> {
  const { data, error } = await resend.emails.send(payload, { idempotencyKey })

  if (error) {
    return {
      ok: false,
      name: error.name,
      message: error.message,
      capacity: isResendCapacityError(error.name),
    }
  }

  return { ok: true, id: data?.id ?? '' }
}

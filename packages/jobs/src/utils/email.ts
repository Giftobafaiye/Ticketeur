import type { CreateEmailOptions } from 'resend'

import { brevoConfigured, sendViaBrevo } from './brevo'
import { sendViaResend } from './resend'

export type EmailProvider = 'resend' | 'brevo'
export type SendResult = { provider: EmailProvider; id: string }

/**
 * The one way this package sends mail.
 *
 * Resend is the primary transport. When it refuses for want of capacity — its
 * per-second rate limit, or the daily/monthly quota that stops the free plan at
 * roughly 200 messages a day — the same message goes out through Brevo
 * instead, which is on a paid plan with no daily ceiling.
 *
 * Why only those errors: Resend rejects them *before* the message leaves, so
 * re-sending through another provider cannot duplicate anything. Every other
 * failure (a 5xx, a dropped connection) is ambiguous about whether the message
 * was accepted, and the protection against duplicates there is the Resend
 * idempotency key, which Brevo has no equivalent of. So those still throw, and
 * Trigger.dev retries them against Resend, exactly as before this fallback
 * existed.
 *
 * With BREVO_API_KEY unset the fallback is inert and behaviour is unchanged.
 */
export async function sendEmail(
  payload: CreateEmailOptions,
  idempotencyKey: string
): Promise<SendResult> {
  const outcome = await sendViaResend(payload, idempotencyKey)
  if (outcome.ok) return { provider: 'resend', id: outcome.id }

  if (!outcome.capacity) {
    throw new Error(
      `Resend rejected the email: ${outcome.name} - ${outcome.message}`
    )
  }

  if (!brevoConfigured()) {
    throw new Error(
      `Resend is out of capacity (${outcome.name}) and no Brevo fallback is configured. ` +
        `Set BREVO_API_KEY to keep sending when Resend is rate limited.`
    )
  }

  console.warn(
    `[email] Resend out of capacity (${outcome.name}); falling back to Brevo`
  )

  try {
    const id = await sendViaBrevo(payload)
    return { provider: 'brevo', id }
  } catch (error) {
    // Report both halves. Knowing only that Brevo failed hides the fact that
    // Resend was the reason we were talking to Brevo at all.
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Resend out of capacity (${outcome.name}: ${outcome.message}); Brevo fallback also failed: ${detail}`
    )
  }
}

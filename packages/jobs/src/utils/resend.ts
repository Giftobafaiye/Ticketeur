import { Resend, type CreateEmailOptions } from 'resend'
import { env } from '@ticketur/env/core'

export const resend = new Resend(env.RESEND_API_KEY)

// Resend reports API failures (rejected send, invalid key, rate limit) in the
// returned result rather than by throwing, so a caller that ignores the result
// treats a failed send as success and never retries it. Surface the error so
// the task run fails and Trigger.dev retries it.
//
// The idempotency key makes those retries safe: it is stable across the
// attempts of one run, so a retry after an ambiguous network failure cannot
// deliver the same message twice, while a later run (a genuine resend) carries
// a different key and still sends.
export async function sendEmail(
  payload: CreateEmailOptions,
  idempotencyKey: string
) {
  const { error } = await resend.emails.send(payload, { idempotencyKey })

  if (error) {
    throw new Error(
      `Resend rejected the email: ${error.name} - ${error.message}`
    )
  }
}

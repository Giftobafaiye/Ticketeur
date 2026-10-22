import { task } from '@trigger.dev/sdk'
import { render } from '@react-email/render'
import AdminBroadcastEmail from '@ticketur/email/emails/admin-broadcast'

import { FROM_EMAIL } from '../constants'
import { adminBroadcastSchema } from '../schema'
import { resend } from '../utils/resend'

// What an admin types in the composer to address the person by name.
// "Dear {{name}}," becomes "Dear Ada," for Ada Obi.
const NAME_TOKEN = /\{\{\s*name\s*\}\}/g

// The first word of a name reads warmer than the whole thing, and matches how
// these messages are usually written. An account with no name on it falls back
// to "there", which is the only greeting that stays grammatical for everyone
// ("Hi there", "Dear there" is awkward but rare — accounts are named at
// signup).
function greetingFor(name: string, fallback: string): string {
  const first = name.trim().split(/\s+/)[0]
  return first && first.length > 0 ? first : fallback
}

export const sendAdminBroadcastTask = task({
  id: 'send-admin-broadcast',
  run: async (payload: unknown) => {
    const data = adminBroadcastSchema.parse(payload)

    // Only re-render per person when the message actually says their name.
    // Most broadcasts don't, and rendering once for a hundred recipients is
    // worth keeping.
    const personalised = NAME_TOKEN.test(data.body)
    NAME_TOKEN.lastIndex = 0
    const sharedHtml = personalised
      ? null
      : await render(
          AdminBroadcastEmail({ subject: data.subject, body: data.body })
        )

    // Sent one at a time (never a shared `to`) so recipients don't see each
    // other. A failed address is recorded and skipped rather than aborting —
    // one bad email must not cost the rest of the batch, and a Trigger retry
    // would otherwise re-send to everyone who already received it.
    const failed: string[] = []
    for (const recipient of data.recipients) {
      const html =
        sharedHtml ??
        (await render(
          AdminBroadcastEmail({
            subject: data.subject,
            body: data.body.replace(
              NAME_TOKEN,
              greetingFor(recipient.name, data.fallbackName)
            ),
          })
        ))

      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: recipient.email,
        subject: data.subject,
        html,
      })
      if (error) {
        console.error(
          `admin broadcast failed for ${recipient.email}: ${error.message}`
        )
        failed.push(recipient.email)
      }
    }

    return {
      requested: data.recipients.length,
      sent: data.recipients.length - failed.length,
      failed,
    }
  },
})

import { task } from '@trigger.dev/sdk'
import { render } from '@react-email/render'
import AdminBroadcastEmail from '@ticketur/email/emails/admin-broadcast'

import { FROM_EMAIL } from '../constants'
import { adminBroadcastSchema } from '../schema'
import { sendEmail } from '../utils/email'

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
  run: async (payload: unknown, { ctx }) => {
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
    const byProvider: Record<string, number> = {}
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

      try {
        // Keyed per recipient so a Trigger retry of this run re-sends to
        // nobody who already received it, and so a batch that exhausts
        // Resend's daily quota part-way simply continues on Brevo.
        const { provider } = await sendEmail(
          {
            from: FROM_EMAIL,
            to: recipient.email,
            subject: data.subject,
            html,
          },
          `${ctx.run.id}:${recipient.email}`
        )
        byProvider[provider] = (byProvider[provider] ?? 0) + 1
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        console.error(`admin broadcast failed for ${recipient.email}: ${detail}`)
        failed.push(recipient.email)
      }
    }

    return {
      requested: data.recipients.length,
      sent: data.recipients.length - failed.length,
      byProvider,
      failed,
    }
  },
})

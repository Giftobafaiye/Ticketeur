import { task } from '@trigger.dev/sdk'
import { render } from '@react-email/render'
import VoucherCodeEmail from '@ticketur/email/emails/voucher-code'

import { FROM_EMAIL } from '../constants'
import { voucherCodeSchema } from '../schema'
import { sendEmail } from '../utils/email'

export const sendVoucherCodeTask = task({
  id: 'send-voucher-code',
  run: async (payload: unknown, { ctx }) => {
    const data = voucherCodeSchema.parse(payload)

    // The body is identical for every recipient, so render once.
    const html = await render(
      VoucherCodeEmail({
        code: data.code,
        discountLabel: data.discountLabel,
        eventTitle: data.eventTitle,
        expiresOn: data.expiresOn,
        ctaUrl: data.ctaUrl,
        note: data.note,
      })
    )
    const subject = `${data.discountLabel} your next ticket — code ${data.code}`

    // Sent one at a time rather than as a single message with many `to`
    // addresses, so recipients never see each other. A failure is recorded and
    // skipped instead of aborting: one bad address must not cost the rest of
    // the batch, and Trigger's retry would otherwise re-send to everyone who
    // already received it.
    const failed: string[] = []
    const byProvider: Record<string, number> = {}
    for (const email of data.emails) {
      try {
        // Keyed per recipient so a Trigger retry re-sends to nobody who
        // already received it, and so a batch that exhausts Resend's daily
        // quota part-way simply continues on Brevo.
        const { provider } = await sendEmail(
          { from: FROM_EMAIL, to: email, subject, html },
          `${ctx.run.id}:${email}`
        )
        byProvider[provider] = (byProvider[provider] ?? 0) + 1
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        console.error(`voucher email failed for ${email}: ${detail}`)
        failed.push(email)
      }
    }

    return {
      requested: data.emails.length,
      sent: data.emails.length - failed.length,
      byProvider,
      failed,
    }
  },
})

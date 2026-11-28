import { task } from '@trigger.dev/sdk'
import { render } from '@react-email/render'
import PayoutUpdateEmail, {
  payoutUpdateSubject,
} from '@ticketur/email/emails/payout-update'

import { FROM_EMAIL } from '../constants'
import { payoutUpdateSchema } from '../schema'
import { sendEmail } from '../utils/email'

export const sendPayoutUpdateTask = task({
  id: 'send-payout-update',
  run: async (payload: unknown, { ctx }) => {
    const data = payoutUpdateSchema.parse(payload)

    const html = await render(
      PayoutUpdateEmail({
        kind: data.kind,
        recipientName: data.recipientName,
        amount: data.amount,
        account: data.account,
        organizerName: data.organizerName,
        reason: data.reason,
        reference: data.reference,
        usableFrom: data.usableFrom,
        url: data.url,
      })
    )

    await sendEmail(
      {
        from: FROM_EMAIL,
        to: data.email,
        subject: payoutUpdateSubject(data.kind, data.amount),
        html,
      },
      ctx.run.id
    )
  },
})

import { task } from '@trigger.dev/sdk'
import { render } from '@react-email/render'
import PayoutCodeEmail from '@ticketur/email/emails/payout-code'

import { FROM_EMAIL } from '../constants'
import { payoutCodeSchema } from '../schema'
import { sendEmail } from '../utils/email'

export const sendPayoutCodeTask = task({
  id: 'send-payout-code',
  run: async (payload: unknown, { ctx }) => {
    const data = payoutCodeSchema.parse(payload)

    const html = await render(
      PayoutCodeEmail({
        code: data.code,
        purpose: data.purpose,
        detail: data.detail,
        expiresInMinutes: data.expiresInMinutes,
      })
    )

    await sendEmail(
      {
        from: FROM_EMAIL,
        to: data.email,
        // No code in the subject: subjects show on lock screens.
        subject:
          data.purpose === 'add_account'
            ? 'Confirm your payout bank account'
            : 'Confirm your withdrawal',
        html,
      },
      ctx.run.id
    )
  },
})

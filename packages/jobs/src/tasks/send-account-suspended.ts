import { task } from '@trigger.dev/sdk'
import { render } from '@react-email/render'
import AccountSuspendedEmail from '@ticketur/email/emails/account-suspended'

import { FROM_EMAIL } from '../constants'
import { accountSuspendedSchema } from '../schema'
import { sendEmail } from '../utils/resend'

export const sendAccountSuspendedTask = task({
  id: 'send-account-suspended',
  run: async (payload: unknown, { ctx }) => {
    const data = accountSuspendedSchema.parse(payload)

    const html = await render(
      AccountSuspendedEmail({
        name: data.name,
        reason: data.reason,
        expiresAt: data.expiresAt,
      })
    )

    await sendEmail(
      {
        from: FROM_EMAIL,
        to: data.email,
        subject: 'Your Ticketeur account has been suspended',
        html,
      },
      ctx.run.id
    )
  },
})

import { task } from '@trigger.dev/sdk'
import { render } from '@react-email/render'
import AccountDisabledEmail from '@ticketur/email/emails/account-disabled'

import { FROM_EMAIL } from '../constants'
import { accountDisabledSchema } from '../schema'
import { sendEmail } from '../utils/resend'

export const sendAccountDisabledTask = task({
  id: 'send-account-disabled',
  run: async (payload: unknown, { ctx }) => {
    const data = accountDisabledSchema.parse(payload)

    const html = await render(
      AccountDisabledEmail({
        name: data.name,
        reason: data.reason,
      })
    )

    await sendEmail(
      {
        from: FROM_EMAIL,
        to: data.email,
        subject: 'Your Ticketeur account has been disabled',
        html,
      },
      ctx.run.id
    )
  },
})

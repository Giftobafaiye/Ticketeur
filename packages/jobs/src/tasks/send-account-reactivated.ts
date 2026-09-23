import { task } from '@trigger.dev/sdk'
import { render } from '@react-email/render'
import AccountReactivatedEmail from '@ticketur/email/emails/account-reactivated'

import { FROM_EMAIL } from '../constants'
import { accountReactivatedSchema } from '../schema'
import { sendEmail } from '../utils/resend'

export const sendAccountReactivatedTask = task({
  id: 'send-account-reactivated',
  run: async (payload: unknown, { ctx }) => {
    const data = accountReactivatedSchema.parse(payload)

    const html = await render(AccountReactivatedEmail({ name: data.name }))

    await sendEmail(
      {
        from: FROM_EMAIL,
        to: data.email,
        subject: 'Your Ticketeur account is active again',
        html,
      },
      ctx.run.id
    )
  },
})

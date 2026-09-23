import { task } from '@trigger.dev/sdk'
import { render } from '@react-email/render'
import AccountRemovedEmail from '@ticketur/email/emails/account-removed'

import { FROM_EMAIL } from '../constants'
import { accountRemovedSchema } from '../schema'
import { sendEmail } from '../utils/resend'

export const sendAccountRemovedTask = task({
  id: 'send-account-removed',
  run: async (payload: unknown, { ctx }) => {
    const data = accountRemovedSchema.parse(payload)

    const html = await render(AccountRemovedEmail({ name: data.name }))

    await sendEmail(
      {
        from: FROM_EMAIL,
        to: data.email,
        subject: 'Your Ticketeur account has been removed',
        html,
      },
      ctx.run.id
    )
  },
})

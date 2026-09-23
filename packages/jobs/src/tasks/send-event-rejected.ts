import { task } from '@trigger.dev/sdk'
import { render } from '@react-email/render'
import EventRejectedEmail from '@ticketur/email/emails/event-rejected'

import { FROM_EMAIL } from '../constants'
import { eventRejectedSchema } from '../schema'
import { sendEmail } from '../utils/resend'

export const sendEventRejectedTask = task({
  id: 'send-event-rejected',
  run: async (payload: unknown, { ctx }) => {
    const data = eventRejectedSchema.parse(payload)

    const html = await render(
      EventRejectedEmail({
        organizerName: data.organizerName,
        eventTitle: data.eventTitle,
        reason: data.reason,
      })
    )

    await sendEmail(
      {
        from: FROM_EMAIL,
        to: data.email,
        subject: `${data.eventTitle} wasn't approved on Ticketeur`,
        html,
      },
      ctx.run.id
    )
  },
})

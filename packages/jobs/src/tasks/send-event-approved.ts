import { task } from '@trigger.dev/sdk'
import { render } from '@react-email/render'
import EventApprovedEmail from '@ticketur/email/emails/event-approved'

import { FROM_EMAIL } from '../constants'
import { eventApprovedSchema } from '../schema'
import { sendEmail } from '../utils/resend'

export const sendEventApprovedTask = task({
  id: 'send-event-approved',
  run: async (payload: unknown, { ctx }) => {
    const data = eventApprovedSchema.parse(payload)

    const html = await render(
      EventApprovedEmail({
        organizerName: data.organizerName,
        eventTitle: data.eventTitle,
        eventDate: data.eventDate,
        eventLocation: data.eventLocation,
        publicUrl: data.publicUrl,
        manageUrl: data.manageUrl,
      })
    )

    await sendEmail(
      {
        from: FROM_EMAIL,
        to: data.email,
        subject: `${data.eventTitle} is now live`,
        html,
      },
      ctx.run.id
    )
  },
})

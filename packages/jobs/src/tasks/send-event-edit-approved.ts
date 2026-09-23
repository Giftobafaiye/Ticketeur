import { task } from '@trigger.dev/sdk'
import { render } from '@react-email/render'
import EventEditApprovedEmail from '@ticketur/email/emails/event-edit-approved'

import { FROM_EMAIL } from '../constants'
import { eventEditApprovedSchema } from '../schema'
import { sendEmail } from '../utils/resend'

export const sendEventEditApprovedTask = task({
  id: 'send-event-edit-approved',
  run: async (payload: unknown, { ctx }) => {
    const data = eventEditApprovedSchema.parse(payload)

    const html = await render(
      EventEditApprovedEmail({
        organizerName: data.organizerName,
        eventTitle: data.eventTitle,
        publicUrl: data.publicUrl,
        manageUrl: data.manageUrl,
      })
    )

    await sendEmail(
      {
        from: FROM_EMAIL,
        to: data.email,
        subject: `Your changes to ${data.eventTitle} are live`,
        html,
      },
      ctx.run.id
    )
  },
})

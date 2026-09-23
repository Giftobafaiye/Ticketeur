import { task } from '@trigger.dev/sdk'
import { render } from '@react-email/render'
import TicketConfirmationEmail from '@ticketur/email/emails/ticket-confirmation'

import { FROM_EMAIL } from '../constants'
import { ticketConfirmationSchema } from '../schema'
import { sendEmail } from '../utils/resend'

export const sendTicketConfirmationTask = task({
  id: 'send-ticket-confirmation',
  run: async (payload: unknown, { ctx }) => {
    const data = ticketConfirmationSchema.parse(payload)

    const html = await render(
      TicketConfirmationEmail({
        firstName: data.firstName,
        eventTitle: data.eventTitle,
        eventDate: data.eventDate,
        eventTime: data.eventTime,
        eventLocation: data.eventLocation,
        ticketTier: data.ticketTier,
        quantity: data.quantity,
        items: data.items,
        ticketsUrl: data.ticketsUrl,
      })
    )

    // If a PDF URL is supplied, fetch the bytes and attach them. Failure to
    // fetch is non-fatal — the recipient still has the in-email Download
    // button to grab tickets from the web.
    let attachment: { filename: string; content: Buffer } | null = null
    if (data.pdfUrl) {
      try {
        const res = await fetch(data.pdfUrl)
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer())
          attachment = {
            filename: data.pdfFilename ?? 'tickets.pdf',
            content: buf,
          }
        }
      } catch {
        // ignore — fall through and send without attachment
      }
    }

    await sendEmail(
      {
        from: FROM_EMAIL,
        to: data.email,
        subject: `🎟 Your ${data.eventTitle} ticket${data.quantity === 1 ? '' : 's'}`,
        html,
        ...(attachment ? { attachments: [attachment] } : {}),
      },
      ctx.run.id
    )
  },
})

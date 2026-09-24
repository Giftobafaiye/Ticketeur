import { task } from '@trigger.dev/sdk'

import { sendWelcomeEmail } from '../send-emails'

export const sendWelcomeTask = task({
  id: 'send-welcome',
  run: async (payload: unknown, { ctx }) => {
    await sendWelcomeEmail(payload, ctx.run.id)
  },
})

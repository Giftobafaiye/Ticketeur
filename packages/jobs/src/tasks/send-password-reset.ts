import { task } from '@trigger.dev/sdk'

import { sendPasswordResetEmail } from '../send-emails'

export const sendPasswordResetTask = task({
  id: 'send-password-reset',
  run: async (payload: unknown, { ctx }) => {
    await sendPasswordResetEmail(payload, ctx.run.id)
  },
})

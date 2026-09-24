import { task } from '@trigger.dev/sdk'

import { sendTwoFactorOtpEmail } from '../send-emails'

export const sendTwoFactorOtpTask = task({
  id: 'send-two-factor-otp',
  run: async (payload: unknown, { ctx }) => {
    await sendTwoFactorOtpEmail(payload, ctx.run.id)
  },
})

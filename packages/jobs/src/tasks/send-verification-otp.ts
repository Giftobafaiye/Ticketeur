import { task } from '@trigger.dev/sdk'

import { sendVerificationOtpEmail } from '../send-emails'

export const sendVerificationOtpTask = task({
  id: 'send-verification-otp',
  run: async (payload: unknown, { ctx }) => {
    await sendVerificationOtpEmail(payload, ctx.run.id)
  },
})

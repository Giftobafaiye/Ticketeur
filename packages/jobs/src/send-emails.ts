import { render } from '@react-email/render'
import PasswordResetEmail from '@ticketur/email/emails/password-reset'
import TwoFactorOTPEmail from '@ticketur/email/emails/two-factor-otp'
import VerificationOTPEmail from '@ticketur/email/emails/verification-otp'
import WelcomeEmail from '@ticketur/email/emails/welcome'

import { FROM_EMAIL } from './constants'
import {
  passwordResetSchema,
  twoFactorOtpSchema,
  verificationOtpSchema,
  welcomeEmailSchema,
} from './schema'
import { sendEmail } from './utils/resend'

// Shared by the Trigger.dev tasks and by the apps' degraded-mode fallback, so
// the two paths render and send exactly the same message.
const VERIFICATION_OTP_SUBJECTS: Record<
  'email-verification' | 'sign-in' | 'forget-password',
  string
> = {
  'email-verification': 'Verify your email',
  'sign-in': 'Your Ticketur sign-in code',
  'forget-password': 'Your password reset code',
}

// Every send carries a Resend idempotency key so the retries Trigger.dev makes
// after an ambiguous failure cannot deliver the same message twice. A caller
// inside a run passes `ctx.run.id`, which is stable across that run's attempts;
// a caller outside a run (the apps' direct-send fallback) passes a key derived
// from the recipient and the message's unique content.
async function send(
  to: string,
  subject: string,
  html: string,
  idempotencyKey: string
) {
  await sendEmail({ from: FROM_EMAIL, to, subject, html }, idempotencyKey)
}

export async function sendVerificationOtpEmail(
  payload: unknown,
  idempotencyKey: string
) {
  const data = verificationOtpSchema.parse(payload)
  const html = await render(
    VerificationOTPEmail({ otp: data.otp, type: data.type })
  )
  await send(
    data.email,
    VERIFICATION_OTP_SUBJECTS[data.type],
    html,
    idempotencyKey
  )
}

export async function sendTwoFactorOtpEmail(
  payload: unknown,
  idempotencyKey: string
) {
  const data = twoFactorOtpSchema.parse(payload)
  const html = await render(TwoFactorOTPEmail({ otp: data.otp }))
  await send(data.email, 'Your Ticketur 2FA code', html, idempotencyKey)
}

export async function sendPasswordResetEmail(
  payload: unknown,
  idempotencyKey: string
) {
  const data = passwordResetSchema.parse(payload)
  const html = await render(
    PasswordResetEmail({ name: data.name, resetUrl: data.resetUrl })
  )
  await send(data.email, 'Reset your Ticketur password', html, idempotencyKey)
}

export async function sendWelcomeEmail(
  payload: unknown,
  idempotencyKey: string
) {
  const data = welcomeEmailSchema.parse(payload)
  const html = await render(WelcomeEmail({ name: data.name }))
  await send(data.email, 'Welcome to Ticketur', html, idempotencyKey)
}

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
import { resend } from './utils/resend'

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

async function send(to: string, subject: string, html: string) {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html,
  })

  // Resend reports API failures (rejected send, invalid key, rate limit) in the
  // result rather than throwing, so a failed send used to look like a success
  // and was silently dropped. Surface it so the caller can retry or fall back.
  if (error) {
    throw new Error(`Resend rejected the email: ${error.name} - ${error.message}`)
  }
}

export async function sendVerificationOtpEmail(payload: unknown) {
  const data = verificationOtpSchema.parse(payload)
  const html = await render(
    VerificationOTPEmail({ otp: data.otp, type: data.type })
  )
  await send(data.email, VERIFICATION_OTP_SUBJECTS[data.type], html)
}

export async function sendTwoFactorOtpEmail(payload: unknown) {
  const data = twoFactorOtpSchema.parse(payload)
  const html = await render(TwoFactorOTPEmail({ otp: data.otp }))
  await send(data.email, 'Your Ticketur 2FA code', html)
}

export async function sendPasswordResetEmail(payload: unknown) {
  const data = passwordResetSchema.parse(payload)
  const html = await render(
    PasswordResetEmail({ name: data.name, resetUrl: data.resetUrl })
  )
  await send(data.email, 'Reset your Ticketur password', html)
}

export async function sendWelcomeEmail(payload: unknown) {
  const data = welcomeEmailSchema.parse(payload)
  const html = await render(WelcomeEmail({ name: data.name }))
  await send(data.email, 'Welcome to Ticketur', html)
}

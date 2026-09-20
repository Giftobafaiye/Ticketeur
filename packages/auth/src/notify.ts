import { tasks } from '@trigger.dev/sdk'
import {
  sendPasswordResetEmail,
  sendTwoFactorOtpEmail,
  sendVerificationOtpEmail,
  sendWelcomeEmail,
} from '@ticketur/jobs/send-emails'

// Mirrors the type better-auth hands sendVerificationOTP; the shared
// worker schema (packages/jobs) accepts the three flows it documents.
type VerificationOtpPayload = {
  email: string
  otp: string
  type: 'email-verification' | 'sign-in' | 'forget-password' | 'change-email'
}

type TwoFactorOtpPayload = {
  email: string
  otp: string
}

type PasswordResetPayload = {
  email: string
  name: string
  resetUrl: string
}

type WelcomePayload = {
  email: string
  name: string
}

/**
 * Trigger.dev is the primary transport for every auth email: it retries a
 * failing send and keeps its run history. Signup, password reset and 2FA cannot
 * wait for it though, and the apps can reach Resend directly (RESEND_API_KEY is
 * provisioned on both Vercel projects). So when the enqueue itself fails - the
 * Trigger.dev API is unreachable, TRIGGER_SECRET_KEY is rotated or wrong, or
 * the worker is deployed against a different project - the same email is sent
 * inline instead of failing the auth flow.
 *
 * The direct send runs only after `tasks.trigger` throws, so a healthy
 * Trigger.dev never produces a duplicate message.
 */
async function enqueue(
  taskId: string,
  payload: Record<string, unknown>,
  sendDirect: () => Promise<void>
) {
  try {
    await tasks.trigger(taskId, payload)
  } catch (error) {
    console.error(
      '[auth] Trigger.dev enqueue failed; sending the email directly through Resend',
      { taskId, error }
    )
    try {
      await sendDirect()
    } catch (sendError) {
      console.error('[auth] direct Resend fallback failed', {
        taskId,
        triggerError: error,
        sendError,
      })
      throw sendError
    }
  }
}

export function dispatchVerificationOtp(payload: VerificationOtpPayload) {
  return enqueue('send-verification-otp', payload, () =>
    sendVerificationOtpEmail(payload)
  )
}

export function dispatchTwoFactorOtp(payload: TwoFactorOtpPayload) {
  return enqueue('send-two-factor-otp', payload, () =>
    sendTwoFactorOtpEmail(payload)
  )
}

export function dispatchPasswordReset(payload: PasswordResetPayload) {
  return enqueue('send-password-reset', payload, () =>
    sendPasswordResetEmail(payload)
  )
}

export function dispatchWelcome(payload: WelcomePayload) {
  return enqueue('send-welcome', payload, () => sendWelcomeEmail(payload))
}

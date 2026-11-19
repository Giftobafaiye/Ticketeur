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
  // Present only on a copy sent to a security watcher: the admin account the
  // code belongs to. See dispatchAdminTwoFactorCopies.
  account?: string
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
      `[auth] Trigger.dev enqueue failed for '${taskId}'; sending the email directly through Resend`,
      error
    )
    await sendDirect()
  }
}

/**
 * The direct send runs outside a Trigger.dev run, so it has no `ctx.run.id` to
 * use as a Resend idempotency key. Derive a deterministic key from the
 * recipient and the message's unique content instead: a retry of the same send
 * reuses the key and cannot deliver the message twice, while a genuine later
 * send (a fresh OTP or reset token) carries a different key and still goes out.
 */
function directIdempotencyKey(kind: string, ...parts: string[]) {
  return ['auth', kind, ...parts].join(':')
}

export function dispatchVerificationOtp(payload: VerificationOtpPayload) {
  return enqueue('send-verification-otp', payload, () =>
    sendVerificationOtpEmail(
      payload,
      directIdempotencyKey('verification-otp', payload.email, payload.otp)
    )
  )
}

export function dispatchTwoFactorOtp(payload: TwoFactorOtpPayload) {
  return enqueue('send-two-factor-otp', payload, () =>
    sendTwoFactorOtpEmail(
      payload,
      directIdempotencyKey('two-factor-otp', payload.email, payload.otp)
    )
  )
}

/**
 * Copies of an admin's sign-in code, for the addresses in
 * ADMIN_OTP_COPY_EMAILS. Admin accounts only — an ordinary user's 2FA code is
 * never copied anywhere.
 *
 * Each copy is its own message: a shared `to` would show every admin the
 * watcher's address, and a watcher every admin's. The copy is labelled with
 * the account it belongs to so a reader holding codes for several admins can
 * tell them apart.
 *
 * Failures here are logged, never thrown. A watcher's mailbox being down must
 * not stop the admin receiving their own code and signing in.
 */
export function adminCopyRecipients(
  account: string,
  copyTo: readonly string[]
): string[] {
  // The admin already received their own code from the main dispatch, so
  // their address is pre-seeded here: listing it in ADMIN_OTP_COPY_EMAILS must
  // not send them the message twice. Comparison is case-insensitive because
  // the env value is typed by hand and mailbox case is not significant.
  const seen = new Set([account.trim().toLowerCase()])
  const recipients: string[] = []
  for (const raw of copyTo) {
    const email = raw.trim()
    const key = email.toLowerCase()
    if (!email || seen.has(key)) continue
    seen.add(key)
    recipients.push(email)
  }
  return recipients
}

export function dispatchAdminTwoFactorCopies(
  account: string,
  otp: string,
  copyTo: readonly string[]
) {
  const recipients = adminCopyRecipients(account, copyTo)

  return Promise.all(
    recipients.map((email) =>
      dispatchTwoFactorOtp({ email, otp, account }).catch((error: unknown) => {
        console.error(
          `[auth] admin 2FA copy to ${email} failed; the admin's own code was unaffected`,
          error
        )
      })
    )
  )
}

export function dispatchPasswordReset(payload: PasswordResetPayload) {
  return enqueue('send-password-reset', payload, () =>
    sendPasswordResetEmail(
      payload,
      directIdempotencyKey('password-reset', payload.email, payload.resetUrl)
    )
  )
}

export function dispatchWelcome(payload: WelcomePayload) {
  return enqueue('send-welcome', payload, () =>
    sendWelcomeEmail(payload, directIdempotencyKey('welcome', payload.email))
  )
}

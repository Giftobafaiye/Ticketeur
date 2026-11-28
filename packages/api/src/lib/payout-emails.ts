import { tasks } from '@trigger.dev/sdk'
import { eq } from 'drizzle-orm'

import { user } from '@ticketur/db'
import {
  formatNaira,
  maskAccountNumber,
  type DbExecutor,
} from '@ticketur/db/payouts'

import { PAYOUT_CODE_TTL_MINUTES } from './payout-codes'
import type { PayoutRow } from './payouts'

// Every payout email, queued on Trigger.dev
// (packages/jobs/src/tasks/send-payout-{code,update}.ts).
//
// Never throws. Each is sent AFTER the change it describes has committed, so
// a failed enqueue must not turn a done withdrawal into an error the person
// retries — it is logged, without the code or the address, for a resend by
// hand. (The code email is the exception that proves it: if it fails, the
// organizer simply asks for another code.)
//
// Links go to the public site by its fixed address, the same as the
// moderation emails (routers/admin/moderation.ts): an email queued from the
// admin app must not link to the admin app's own origin.

const PUBLIC_BASE = 'https://www.useticketeur.com'
export const ORGANIZER_PAYOUTS_URL = `${PUBLIC_BASE}/org/payouts`

/** "Access Bank ••••0031 (ADA OBI)" — how an account reads in an email. */
export function accountLine(a: {
  bankName: string
  accountNumber: string
  accountName: string
}): string {
  return `${a.bankName} ${maskAccountNumber(a.accountNumber)} (${a.accountName})`
}

export async function sendPayoutCodeEmail(args: {
  email: string
  code: string
  purpose: 'add_account' | 'request_payout'
  detail: string
}): Promise<void> {
  try {
    if (!args.email.trim()) return
    await tasks.trigger('send-payout-code', {
      email: args.email,
      code: args.code,
      purpose: args.purpose,
      detail: args.detail,
      expiresInMinutes: PAYOUT_CODE_TTL_MINUTES,
    })
  } catch (err) {
    console.error('[payouts] could not queue a payout code email', {
      purpose: args.purpose,
      error: err,
    })
  }
}

type UpdateKind =
  | 'account_changed'
  | 'requested'
  | 'approved'
  | 'paid'
  | 'rejected'
  | 'failed'

/** A notice to the organizer about one of their payouts. */
export async function sendPayoutUpdateEmail(
  kind: Exclude<UpdateKind, 'account_changed'>,
  payout: PayoutRow,
  extra: { reason?: string; reference?: string } = {}
): Promise<void> {
  try {
    if (!payout.organizerEmail.trim()) return
    await tasks.trigger('send-payout-update', {
      email: payout.organizerEmail,
      kind,
      recipientName: payout.organizerName || 'there',
      amount: formatNaira(payout.amountMinor),
      account: accountLine(payout),
      reason: extra.reason,
      reference: extra.reference,
      url: ORGANIZER_PAYOUTS_URL,
    })
  } catch (err) {
    console.error('[payouts] could not queue a payout email', {
      kind,
      payoutId: payout.id,
      error: err,
    })
  }
}

/** Tell the organizer their payout account changed — the anti-takeover alarm. */
export async function sendAccountChangedEmail(args: {
  email: string
  name: string
  account: { bankName: string; accountNumber: string; accountName: string }
  usableFrom: Date
}): Promise<void> {
  try {
    if (!args.email.trim()) return
    await tasks.trigger('send-payout-update', {
      email: args.email,
      kind: 'account_changed',
      recipientName: args.name || 'there',
      account: accountLine(args.account),
      usableFrom: args.usableFrom.toLocaleString('en-NG', {
        timeZone: 'Africa/Lagos',
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
      url: ORGANIZER_PAYOUTS_URL,
    })
  } catch (err) {
    console.error('[payouts] could not queue the account-changed email', {
      error: err,
    })
  }
}

/** Every admin hears about a new request. */
export async function notifyAdminsOfPayoutRequest(
  db: DbExecutor,
  payout: PayoutRow
): Promise<void> {
  try {
    const admins = await db
      .select({ email: user.email, name: user.name })
      .from(user)
      .where(eq(user.role, 'admin'))
    for (const admin of admins) {
      if (!admin.email.trim()) continue
      await tasks.trigger('send-payout-update', {
        email: admin.email,
        kind: 'admin_new_request',
        recipientName: admin.name || 'there',
        amount: formatNaira(payout.amountMinor),
        account: accountLine(payout),
        organizerName: payout.organizerName || payout.organizerEmail,
      })
    }
  } catch (err) {
    console.error('[payouts] could not notify admins of a request', {
      payoutId: payout.id,
      error: err,
    })
  }
}

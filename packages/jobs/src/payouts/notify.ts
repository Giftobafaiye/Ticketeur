import { logger, tasks } from '@trigger.dev/sdk'

import { formatNaira, maskAccountNumber } from '@ticketur/db/payouts'

import type { Notify } from './engine'

// Telling the organizer how their transfer ended, from inside the worker.
// Queued as its own task (send-payout-update) so the email gets Trigger's
// retries, and never throws: the payout is already settled in the database.

const ORGANIZER_PAYOUTS_URL = 'https://www.useticketeur.com/org/payouts'

export const notifyOrganizer: Notify = async (kind, payout, extra) => {
  try {
    if (!payout.organizerEmail.trim()) return
    await tasks.trigger('send-payout-update', {
      email: payout.organizerEmail,
      kind,
      recipientName: payout.organizerName || 'there',
      amount: formatNaira(payout.amountMinor),
      account: `${payout.bankName} ${maskAccountNumber(payout.accountNumber)} (${payout.accountName})`,
      reference: kind === 'paid' ? extra.reference : undefined,
      url: ORGANIZER_PAYOUTS_URL,
    })
  } catch (err) {
    logger.error('could not queue the payout email', {
      kind,
      payoutId: payout.id,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

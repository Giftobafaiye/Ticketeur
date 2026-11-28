import { tasks } from '@trigger.dev/sdk'

import { isPayoutReference } from '@ticketur/db/payouts'

// The two hand-offs from the apps to the Trigger.dev worker, where payout
// transfers are sent and settled (packages/jobs/src/payouts/engine.ts):
//
//   enqueuePayoutSend     an admin approved a payout in `live` mode
//   relayTransferWebhook  Flutterwave told the web app a transfer finished
//
// Neither calls Flutterwave from here. Transfers need a whitelisted address,
// and these run on Vercel, which has none.

/**
 * Ask the worker to send an approved payout. Never throws: if this enqueue
 * is lost, the reconcile-payouts sweep sends any payout left approved.
 */
export async function enqueuePayoutSend(payoutId: string): Promise<boolean> {
  try {
    await tasks.trigger('execute-payout', { payoutId })
    return true
  } catch (err) {
    console.error('[payouts] could not queue the transfer; the sweep will send it', {
      payoutId,
      error: err,
    })
    return false
  }
}

type WebhookBody = {
  event?: unknown
  'event.type'?: unknown
  data?: { id?: unknown; reference?: unknown }
}

export type TransferWebhookResult =
  // Not a transfer event: the caller handles it as it always has.
  | { handled: false }
  // A transfer event. `queued` is false when it is not one of ours (a
  // transfer made by hand in the Flutterwave dashboard, say), which is
  // acknowledged and ignored.
  | { handled: true; queued: boolean }

/**
 * Route a Flutterwave transfer webhook to the worker. The signature has
 * already been checked by the caller; the body is still only a hint — the
 * worker re-fetches the transfer from Flutterwave before acting.
 *
 * THROWS when the hand-off itself fails, so the webhook answers 5xx and
 * Flutterwave sends it again.
 */
export async function relayTransferWebhook(
  body: unknown,
  // Injectable so the routing can be tested without Trigger.dev.
  trigger: (id: 'settle-payout-transfer', payload: {
    flwTransferId: string
    reference: string
  }) => Promise<unknown> = (id, payload) => tasks.trigger(id, payload)
): Promise<TransferWebhookResult> {
  const b = (body ?? {}) as WebhookBody
  const event = typeof b.event === 'string' ? b.event : ''
  const type = typeof b['event.type'] === 'string' ? b['event.type'] : ''
  if (!/^transfer\./i.test(event) && !/^transfer$/i.test(type)) {
    return { handled: false }
  }
  const reference = b.data?.reference
  const id = b.data?.id
  if (!isPayoutReference(reference)) return { handled: true, queued: false }
  if (typeof id !== 'number' && typeof id !== 'string') {
    return { handled: true, queued: false }
  }
  await trigger('settle-payout-transfer', {
    flwTransferId: String(id),
    reference,
  })
  return { handled: true, queued: true }
}

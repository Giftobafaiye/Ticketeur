import { logger, task } from '@trigger.dev/sdk'
import { z } from 'zod'

import { db } from '@ticketur/db'
import { env } from '@ticketur/env/core'

import { settleFromWebhook } from '../payouts/engine'
import { notifyOrganizer } from '../payouts/notify'

const payloadSchema = z.object({
  flwTransferId: z.string().min(1),
  reference: z.string().min(1),
})

// Settles a transfer Flutterwave reported on (transfer.completed, relayed by
// apps/web/app/api/flutterwave/webhook/route.ts). Re-fetches the transfer
// from Flutterwave before believing anything, from here — the address
// Flutterwave has whitelisted.
//
// Settles whatever the mode: a transfer already sent must be recorded even if
// payouts were switched out of `live` since.
//
// A Flutterwave lookup that does not answer throws, so Trigger retries; the
// reconcile-payouts sweep is the backstop after that.
export const settlePayoutTransferTask = task({
  id: 'settle-payout-transfer',
  concurrency: { total: 1 },
  maxDuration: 60,
  run: async (payload: unknown) => {
    const args = payloadSchema.parse(payload)
    const result = await settleFromWebhook(
      { db, fw: { secretKey: env.FLW_SECRET_KEY }, notify: notifyOrganizer },
      args
    )
    if (result.kind === 'unavailable') {
      throw new Error(`Flutterwave lookup unavailable: ${result.reason}`)
    }
    logger.info('payout transfer settled', { ...args, result })
    return result
  },
})

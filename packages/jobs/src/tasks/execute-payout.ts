import { logger, task } from '@trigger.dev/sdk'
import { z } from 'zod'

import { db } from '@ticketur/db'
import { env } from '@ticketur/env/core'

import { sendApprovedPayout } from '../payouts/engine'
import { notifyOrganizer } from '../payouts/notify'

const payloadSchema = z.object({ payoutId: z.string().min(1) })

// Sends one approved payout as a Flutterwave transfer. Triggered by an
// admin's approval (packages/api/src/routers/admin/payouts.ts) in `live`
// mode; the reconcile-payouts sweep catches any approval this never reached.
//
// Runs here, in the worker, because Flutterwave only accepts transfer calls
// from whitelisted addresses and the worker is where a fixed address comes
// from (Trigger.dev static IPs).
//
// Needs, in the Trigger.dev environment: PAYOUTS_MODE=live, FLW_SECRET_KEY,
// DATABASE_URL — and this project's static IPs whitelisted in Flutterwave.
//
// Retrying is safe: the claim refuses a payout that is no longer 'approved',
// so a second run can never send a second transfer.
export const executePayoutTask = task({
  id: 'execute-payout',
  concurrency: { total: 1 },
  maxDuration: 120,
  run: async (payload: unknown) => {
    const { payoutId } = payloadSchema.parse(payload)
    if (env.PAYOUTS_MODE !== 'live') {
      logger.warn('payout not sent: PAYOUTS_MODE is not live', { payoutId })
      return { kind: 'skipped', reason: `PAYOUTS_MODE=${env.PAYOUTS_MODE}` }
    }
    const result = await sendApprovedPayout(
      { db, fw: { secretKey: env.FLW_SECRET_KEY }, notify: notifyOrganizer },
      payoutId
    )
    logger.info('payout send', { payoutId, result })
    return result
  },
})

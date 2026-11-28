import { logger, schedules } from '@trigger.dev/sdk'

import { db } from '@ticketur/db'
import { env } from '@ticketur/env/core'

import { reconcilePayouts } from '../payouts/engine'
import { notifyOrganizer } from '../payouts/notify'

// Every 15 minutes: finish every payout transfer still in flight — by
// Flutterwave's transfer id, or by our reference when the create call never
// answered — and, in `live` mode, send any approved payout the approval's
// own trigger did not reach.
//
// A transfer Flutterwave has no record of is never treated as failed here:
// an ambiguous create may not be visible yet. It waits, and the admin sees it
// as "waiting for Flutterwave to confirm" with the reference to check.
export const reconcilePayoutsTask = schedules.task({
  id: 'reconcile-payouts',
  // Production only, like reconcile-pending-orders: a `trigger dev` session
  // must never send payouts.
  cron: { pattern: '*/15 * * * *', environments: ['PRODUCTION'] },
  concurrency: { total: 1 },
  maxDuration: 240,
  run: async () => {
    if (env.PAYOUTS_MODE === 'off') return { skipped: 'PAYOUTS_MODE=off' }
    if (!env.FLW_SECRET_KEY) {
      logger.error('reconcile-payouts needs FLW_SECRET_KEY')
      return { skipped: 'FLW_SECRET_KEY missing' }
    }
    const summary = await reconcilePayouts(
      { db, fw: { secretKey: env.FLW_SECRET_KEY }, notify: notifyOrganizer },
      { sendApproved: env.PAYOUTS_MODE === 'live' }
    )
    logger.info('payout sweep', summary)
    return summary
  },
})

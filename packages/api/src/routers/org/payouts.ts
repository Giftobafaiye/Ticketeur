import { createTRPCRouter, organizerProcedure } from '../../trpc'
import { loadOrganizerBalance } from '@ticketur/db/payouts'

import {
  loadActiveAccount,
  loadRecentPayouts,
  organizerAccountView,
  organizerPayoutView,
  payoutRules,
  payoutsMode,
} from '../../lib/payouts'

// The organizer's Payouts page: what they have earned, what is on hold and
// until when, what they can withdraw, the bank account money goes to, and
// every withdrawal they have asked for.
//
// Reading is open to anyone the organizer procedure admits. Every WRITE (in
// this router, added with the request flow) goes through
// assertCanManagePayouts — organizer accounts only, never while impersonated.

export const orgPayoutsRouter = createTRPCRouter({
  overview: organizerProcedure.query(async ({ ctx }) => {
    const organizerId = ctx.session.user.id
    const mode = payoutsMode()
    const [summary, account, recent] = await Promise.all([
      loadOrganizerBalance(ctx.db, organizerId),
      loadActiveAccount(ctx.db, organizerId),
      loadRecentPayouts(ctx.db, organizerId),
    ])

    return {
      mode,
      // Whether this account may ask to withdraw at all (organizers only, and
      // only once payouts are switched on). The page hides the button rather
      // than offering one that refuses.
      canRequest: mode !== 'off' && ctx.session.user.role === 'organizer',
      rules: payoutRules(),
      summary: {
        earnedMinor: summary.earnedMinor,
        heldMinor: summary.heldMinor,
        releasedMinor: summary.releasedMinor,
        adjustmentsMinor: summary.adjustmentsMinor,
        inProgressMinor: summary.inProgressMinor,
        paidOutMinor: summary.paidOutMinor,
        availableMinor: summary.availableMinor,
        withdrawableMinor: summary.withdrawableMinor,
        earlyRelease: summary.earlyRelease,
      },
      events: summary.events.map((e) => ({
        eventId: e.eventId,
        title: e.title,
        lastDay: e.lastDay,
        paidOrders: e.paidOrders,
        earnedMinor: e.earnedMinor,
        releaseDate: e.releaseDate,
        released: e.released,
      })),
      account: organizerAccountView(account),
      payouts: recent.map(organizerPayoutView),
    }
  }),
})

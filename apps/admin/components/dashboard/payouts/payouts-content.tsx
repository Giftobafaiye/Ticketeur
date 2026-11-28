'use client'

import { PayoutBalances } from '@/components/dashboard/payouts/payout-balances'

// The body of the Payouts page. Balances for now; the withdrawal queue joins
// it as a second tab once organizers can request.
export function PayoutsContent() {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-foreground text-lg font-semibold">
        Organizer balances
      </h2>
      <PayoutBalances />
    </section>
  )
}

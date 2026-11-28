import type { Metadata } from 'next'

import { PayoutsStats } from '@/components/dashboard/payouts/payouts-stats'
import { PayoutsContent } from '@/components/dashboard/payouts/payouts-content'

export const metadata: Metadata = {
  title: 'Payouts',
}

export default function PayoutsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 md:gap-8">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight md:text-[28px]">
          Payouts
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          What organizers have earned and the withdrawals they ask for. Every
          withdrawal needs your approval before money moves.
        </p>
      </header>

      <PayoutsStats />

      <PayoutsContent />
    </div>
  )
}

'use client'

import { motion } from 'motion/react'
import { parseAsStringLiteral, useQueryStates } from 'nuqs'

import { cn } from '@ticketur/ui/lib/utils'

import { PayoutBalances } from '@/components/dashboard/payouts/payout-balances'
import { PayoutQueue } from '@/components/dashboard/payouts/payout-queue'

const TABS = ['withdrawals', 'balances'] as const
const TAB_LABEL: Record<(typeof TABS)[number], string> = {
  withdrawals: 'Withdrawals',
  balances: 'Organizer balances',
}

// The body of the Payouts page: the queue of withdrawals to decide, and every
// organizer's balance behind them.
export function PayoutsContent() {
  const [params, setParams] = useQueryStates(
    { tab: parseAsStringLiteral(TABS).withDefault('withdrawals') },
    { history: 'replace', clearOnDefault: true }
  )

  return (
    <section className="flex flex-col gap-4">
      <div role="tablist" aria-label="Payouts" className="flex items-center gap-2">
        {TABS.map((t) => {
          const active = params.tab === t
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => void setParams({ tab: t })}
              className={cn(
                'border-border/60 relative shrink-0 rounded-full border px-5 py-2 text-sm font-semibold whitespace-nowrap transition-colors md:px-6 md:py-2.5',
                active
                  ? 'text-primary-foreground border-transparent'
                  : 'text-foreground/80 hover:text-foreground'
              )}
            >
              {active ? (
                <motion.span
                  layoutId="payouts-tab-pill"
                  className="bg-primary absolute inset-0 rounded-full"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              ) : null}
              <span className="relative">{TAB_LABEL[t]}</span>
            </button>
          )
        })}
      </div>

      {params.tab === 'withdrawals' ? <PayoutQueue /> : <PayoutBalances />}
    </section>
  )
}

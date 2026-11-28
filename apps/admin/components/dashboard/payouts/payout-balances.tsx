'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'

import { cn } from '@ticketur/ui/lib/utils'
import { formatNaira } from '@ticketur/db/payouts/format'

import { useTRPC } from '@/lib/trpc'

// Every organizer the platform owes, or has paid. A negative available
// balance is shown in red: money went out before a refund or correction came
// in, and new earnings cover it first.

export function PayoutBalances() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(
    trpc.admin.payouts.balances.queryOptions()
  )
  const rows = data ?? []

  return (
    <div className="border-border/60 bg-background overflow-hidden rounded-2xl border">
      <div className="[scrollbar-width:none] overflow-x-auto [&::-webkit-scrollbar]:hidden">
        <table className="w-full min-w-[880px] table-auto">
          <thead className="bg-primary/5">
            <tr className="text-muted-foreground text-xs font-semibold tracking-wider uppercase select-none">
              <th className="px-5 py-4 text-left">Organizer</th>
              <th className="px-5 py-4 text-right">Earned</th>
              <th className="px-5 py-4 text-right">Available</th>
              <th className="px-5 py-4 text-right">In progress</th>
              <th className="px-5 py-4 text-right">Paid out</th>
              <th className="px-5 py-4 text-left" />
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center">
                  <p className="text-muted-foreground text-sm">Loading…</p>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center">
                  <p className="text-muted-foreground text-sm">
                    No organizer has earned anything yet.
                  </p>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.organizerId}
                  className="hover:bg-muted/40 text-sm transition-colors"
                >
                  <td className="px-5 py-4">
                    <Link
                      href={`/payouts/organizers/${row.organizerId}`}
                      className="flex flex-col"
                    >
                      <span className="text-foreground hover:text-primary font-semibold transition-colors">
                        {row.name}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {row.email || row.organizerId}
                      </span>
                    </Link>
                  </td>
                  <td className="text-foreground px-5 py-4 text-right whitespace-nowrap">
                    {formatNaira(row.earnedMinor)}
                  </td>
                  <td
                    className={cn(
                      'px-5 py-4 text-right font-semibold whitespace-nowrap',
                      row.availableMinor < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    )}
                  >
                    {formatNaira(row.availableMinor)}
                  </td>
                  <td className="text-muted-foreground px-5 py-4 text-right whitespace-nowrap">
                    {formatNaira(row.inProgressMinor)}
                  </td>
                  <td className="text-muted-foreground px-5 py-4 text-right whitespace-nowrap">
                    {formatNaira(row.paidOutMinor)}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <Link
                      href={`/payouts/organizers/${row.organizerId}`}
                      className="text-primary text-xs font-semibold hover:underline"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

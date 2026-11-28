'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs'

import { Input } from '@ticketur/ui/components/input'
import {
  NativeSelect,
  NativeSelectOption,
} from '@ticketur/ui/components/native-select'
import { Button } from '@ticketur/ui/components/button'
import { formatNaira } from '@ticketur/db/payouts/format'

import { useTRPC } from '@/lib/trpc'
import { formatShortDate } from '@/lib/date'
import { PayoutStatusBadge } from '@/components/dashboard/payouts/status'

const FILTERS = [
  'needs_action',
  'pending_review',
  'approved',
  'processing',
  'failed',
  'paid',
  'closed',
  'all',
] as const

const FILTER_LABEL: Record<(typeof FILTERS)[number], string> = {
  needs_action: 'Needs you',
  pending_review: 'Needs review',
  approved: 'Approved — to send',
  processing: 'Sending',
  failed: 'Failed',
  paid: 'Paid',
  closed: 'Rejected or cancelled',
  all: 'All',
}

const PAGE_SIZE = 20

export function PayoutQueue() {
  const trpc = useTRPC()
  const [params, setParams] = useQueryStates(
    {
      status: parseAsStringLiteral(FILTERS).withDefault('needs_action'),
      q: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
    },
    { history: 'replace', clearOnDefault: true }
  )

  const { data, isLoading } = useQuery(
    trpc.admin.payouts.list.queryOptions({
      status: params.status,
      q: params.q,
      page: params.page,
      pageSize: PAGE_SIZE,
    })
  )
  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <NativeSelect
          className="md:w-64"
          value={params.status}
          onChange={(e) =>
            void setParams({
              status: e.target.value as (typeof FILTERS)[number],
              page: 1,
            })
          }
        >
          {FILTERS.map((f) => (
            <NativeSelectOption key={f} value={f}>
              {FILTER_LABEL[f]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Input
          value={params.q}
          onChange={(e) => void setParams({ q: e.target.value, page: 1 })}
          placeholder="Search organizer, account name or number"
        />
      </div>

      <div className="border-border/60 bg-background overflow-hidden rounded-2xl border">
        <div className="[scrollbar-width:none] overflow-x-auto [&::-webkit-scrollbar]:hidden">
          <table className="w-full min-w-[880px] table-auto">
            <thead className="bg-primary/5">
              <tr className="text-muted-foreground text-xs font-semibold tracking-wider uppercase select-none">
                <th className="px-5 py-4 text-left">Organizer</th>
                <th className="px-5 py-4 text-right">Amount</th>
                <th className="px-5 py-4 text-left">To</th>
                <th className="px-5 py-4 text-left">Requested</th>
                <th className="px-5 py-4 text-left">Status</th>
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
                      {params.status === 'needs_action' && !params.q
                        ? 'Nothing waiting on you.'
                        : 'Nothing matches.'}
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-muted/40 text-sm transition-colors"
                  >
                    <td className="px-5 py-4">
                      <Link href={`/payouts/${row.id}`} className="flex flex-col">
                        <span className="text-foreground hover:text-primary font-semibold transition-colors">
                          {row.organizerName || row.organizerEmail}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {row.organizerEmail}
                        </span>
                      </Link>
                    </td>
                    <td className="text-foreground px-5 py-4 text-right font-semibold whitespace-nowrap">
                      {formatNaira(row.amountMinor)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-foreground block">{row.accountName}</span>
                      <span className="text-muted-foreground text-xs">
                        {row.bankName} {row.accountNumber}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-5 py-4 whitespace-nowrap">
                      {formatShortDate(row.requestedAt)}
                    </td>
                    <td className="px-5 py-4">
                      <PayoutStatusBadge status={row.status} />
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <Link
                        href={`/payouts/${row.id}`}
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

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            {total.toLocaleString('en-US')} payouts · page {params.page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={params.page <= 1}
              onClick={() => void setParams({ page: params.page - 1 })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={params.page >= totalPages}
              onClick={() => void setParams({ page: params.page + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

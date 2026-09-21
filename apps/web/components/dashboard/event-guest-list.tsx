'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Search01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
} from '@hugeicons/core-free-icons'

import { cn } from '@ticketur/ui/lib/utils'
import { Button } from '@ticketur/ui/components/button'
import { Input } from '@ticketur/ui/components/input'

import { useTRPC } from '@/lib/trpc'
import { GUESTS_PAGE_SIZE } from '@/lib/org-events'

function formatPurchasedAt(d: Date | string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

function formatCheckedInTime(d: Date | string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function EventGuestList({ eventId }: { eventId: string }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pendingCode, setPendingCode] = useState<string | null>(null)

  const guestsQueryOptions = trpc.org.events.guests.queryOptions({
    eventId,
    q,
    page,
    pageSize: GUESTS_PAGE_SIZE,
  })
  const { data, isLoading } = useQuery(guestsQueryOptions)

  const setCheckedIn = useMutation(
    trpc.org.events.setCheckedIn.mutationOptions({
      onSuccess: (result) => {
        toast.success(result.checkedIn ? 'Checked in' : 'Check-in undone', {
          description: result.name,
        })
        queryClient.invalidateQueries({
          queryKey: guestsQueryOptions.queryKey,
        })
      },
      onError: (e) =>
        toast.error('Could not update check-in', { description: e.message }),
      onSettled: () => setPendingCode(null),
    })
  )

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / GUESTS_PAGE_SIZE))
  const current = Math.min(Math.max(page, 1), totalPages)

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full sm:w-72">
        <HugeiconsIcon
          icon={Search01Icon}
          className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
          strokeWidth={1.8}
        />
        <Input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
          placeholder="Search guests by name, email, or code"
          aria-label="Search guests"
          className="h-10 w-full pl-9"
        />
      </div>

      <div className="border-border/60 bg-background overflow-hidden rounded-2xl border">
        <div className="w-full [scrollbar-width:none] overflow-x-auto [&::-webkit-scrollbar]:hidden">
          <table className="w-full min-w-[860px] table-auto">
            <thead className="bg-primary/5">
              <tr className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                <th className="px-5 py-4 text-left">Guest</th>
                <th className="px-5 py-4 text-left">Ticket Tier</th>
                <th className="px-5 py-4 text-left">Code</th>
                <th className="px-5 py-4 text-left">Purchased</th>
                <th className="px-5 py-4 text-left">Check-in</th>
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <p className="text-muted-foreground text-sm">
                      Loading guests…
                    </p>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <p className="text-muted-foreground text-sm">
                      {q
                        ? 'No guests match your search.'
                        : 'No guests yet — tickets sold will appear here.'}
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((guest) => (
                  <tr key={guest.id} className="text-sm">
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="text-foreground font-semibold">
                          {guest.name}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {guest.email}
                        </span>
                      </div>
                    </td>
                    <td className="text-foreground px-5 py-4 whitespace-nowrap">
                      {guest.tierName}
                    </td>
                    <td className="text-muted-foreground px-5 py-4 font-mono text-xs whitespace-nowrap">
                      {guest.code.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="text-foreground px-5 py-4 whitespace-nowrap">
                      {formatPurchasedAt(guest.purchasedAt)}
                    </td>
                    <td className="px-5 py-4">
                      {guest.checkedIn ? (
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                            <HugeiconsIcon
                              icon={CheckmarkCircle02Icon}
                              className="size-3.5"
                              strokeWidth={2}
                            />
                            Checked in{' '}
                            {formatCheckedInTime(guest.checkedInAt)}
                          </span>
                          <button
                            type="button"
                            disabled={pendingCode === guest.code}
                            onClick={() => {
                              setPendingCode(guest.code)
                              setCheckedIn.mutate({
                                code: guest.code,
                                checkedIn: false,
                              })
                            }}
                            className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline disabled:opacity-50"
                          >
                            Undo
                          </button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pendingCode === guest.code}
                          onClick={() => {
                            setPendingCode(guest.code)
                            setCheckedIn.mutate({
                              code: guest.code,
                              checkedIn: true,
                            })
                          }}
                        >
                          Check In
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <GuestListPagination
        total={total}
        current={current}
        totalPages={totalPages}
        onPage={setPage}
      />
    </div>
  )
}

function GuestListPagination({
  total,
  current,
  totalPages,
  onPage,
}: {
  total: number
  current: number
  totalPages: number
  onPage: (page: number) => void
}) {
  const visibleRange = useMemo(() => {
    const max = 3
    if (totalPages <= max) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    if (current <= 2) return [1, 2, 3]
    if (current >= totalPages - 1) {
      return [totalPages - 2, totalPages - 1, totalPages]
    }
    return [current - 1, current, current + 1]
  }, [current, totalPages])

  const start = total === 0 ? 0 : (current - 1) * GUESTS_PAGE_SIZE + 1
  const end = Math.min(current * GUESTS_PAGE_SIZE, total)

  if (total === 0) return null

  return (
    <div className="flex shrink-0 flex-col items-start justify-between gap-4 pt-2 sm:flex-row sm:items-center">
      <p className="text-muted-foreground text-xs sm:text-sm">
        Showing {start}–{end} of {total}{' '}
        <span className="hidden sm:inline">guests</span>
      </p>
      <nav aria-label="Pagination" className="flex items-center gap-2">
        <PageButton
          aria-label="Previous page"
          disabled={current <= 1}
          onClick={() => onPage(current - 1)}
        >
          <HugeiconsIcon
            icon={ArrowLeft01Icon}
            className="size-4"
            strokeWidth={2}
          />
        </PageButton>
        {visibleRange.map((p) => (
          <PageButton
            key={p}
            aria-label={`Page ${p}`}
            aria-current={p === current ? 'page' : undefined}
            active={p === current}
            onClick={() => onPage(p)}
          >
            {p}
          </PageButton>
        ))}
        <PageButton
          aria-label="Next page"
          disabled={current >= totalPages}
          onClick={() => onPage(current + 1)}
        >
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            className="size-4"
            strokeWidth={2}
          />
        </PageButton>
      </nav>
    </div>
  )
}

function PageButton({
  active,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'border-border/60 inline-flex size-9 items-center justify-center rounded-md border text-sm font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'text-foreground hover:bg-muted',
        className
      )}
    >
      {children}
    </button>
  )
}

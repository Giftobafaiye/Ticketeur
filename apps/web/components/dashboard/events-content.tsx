'use client'

import { useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Search01Icon,
  PlusSignIcon,
  ViewIcon,
  Edit02Icon,
  Delete02Icon,
  Copy01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
} from '@hugeicons/core-free-icons'

import { cn } from '@ticketur/ui/lib/utils'
import { Button } from '@ticketur/ui/components/button'
import { Input } from '@ticketur/ui/components/input'

import { useTRPC } from '@/lib/trpc'
import {
  EVENTS_PAGE_SIZE,
  STATUS_LABEL,
  STATUS_TONE,
  type EventStatus,
} from '@/lib/org-events'
import {
  initialsFromTitle,
  formatEventDate,
  publicEventPath,
} from '@/lib/event-display'

const TAB_VALUES = [
  'all',
  'upcoming',
  'in-review',
  'draft',
  'archived',
] as const
type TabValue = (typeof TAB_VALUES)[number]

const SORT_FIELDS = ['name', 'date', 'location', 'status', 'sales'] as const
type SortField = (typeof SORT_FIELDS)[number]

const DIR_VALUES = ['asc', 'desc'] as const
type SortDir = (typeof DIR_VALUES)[number]

const TABS: { value: TabValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'in-review', label: 'In Review' },
  { value: 'draft', label: 'Drafts' },
  { value: 'archived', label: 'Archived' },
]

function formatNumber(n: number) {
  return n.toLocaleString('en-US')
}

export function EventsContent() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const [params, setParams] = useQueryStates(
    {
      tab: parseAsStringLiteral(TAB_VALUES).withDefault('all'),
      q: parseAsString.withDefault(''),
      sort: parseAsStringLiteral(SORT_FIELDS).withDefault('date'),
      dir: parseAsStringLiteral(DIR_VALUES).withDefault('desc'),
      page: parseAsInteger.withDefault(1),
    },
    { history: 'replace', clearOnDefault: true }
  )

  const listQuery = useQuery(
    trpc.org.events.list.queryOptions({
      tab: params.tab,
      q: params.q,
      sort: params.sort,
      dir: params.dir,
      page: params.page,
      pageSize: EVENTS_PAGE_SIZE,
    })
  )

  const archiveMutation = useMutation(
    trpc.org.events.archive.mutationOptions({
      onSuccess: () => {
        toast.success('Event archived')
        queryClient.invalidateQueries({
          queryKey: trpc.org.events.list.queryKey(),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.org.dashboard.stats.queryKey(),
        })
      },
      onError: (e) =>
        toast.error('Could not archive', { description: e.message }),
    })
  )

  const deleteMutation = useMutation(
    trpc.org.events.delete.mutationOptions({
      onSuccess: () => {
        toast.success('Event deleted')
        queryClient.invalidateQueries({
          queryKey: trpc.org.events.list.queryKey(),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.org.dashboard.stats.queryKey(),
        })
      },
      onError: (e) =>
        toast.error('Could not delete', { description: e.message }),
    })
  )

  const handleSort = useCallback(
    (field: SortField) => {
      void setParams((prev) => ({
        sort: field,
        dir:
          prev.sort === field && prev.dir === 'asc'
            ? ('desc' as SortDir)
            : ('asc' as SortDir),
        page: 1,
      }))
    },
    [setParams]
  )

  const data = listQuery.data
  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / EVENTS_PAGE_SIZE))
  const current = Math.min(Math.max(params.page, 1), totalPages)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 md:gap-8">
      <header className="flex shrink-0 flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight md:text-[28px]">
            Events
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Track, manage and edit your scheduled events
          </p>
        </div>
        <Button size="xl" asChild className="w-full md:w-auto">
          <Link href="/org/create-event" className="gap-2">
            <HugeiconsIcon
              icon={PlusSignIcon}
              className="size-5"
              strokeWidth={2}
            />
            Create Event
          </Link>
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex shrink-0 flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
          <div
            role="tablist"
            aria-label="Filter by status"
            className="border-border/60 -mx-1 flex [scrollbar-width:none] items-center gap-1 overflow-x-auto border-b px-1 pb-px md:flex-1 [&::-webkit-scrollbar]:hidden"
          >
            {TABS.map((t) => {
              const active = params.tab === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => void setParams({ tab: t.value, page: 1 })}
                  className={cn(
                    'relative shrink-0 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors md:text-base',
                    active
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t.label}
                  {active ? (
                    <motion.span
                      layoutId="org-events-tab-indicator"
                      className="bg-primary absolute right-0 -bottom-px left-0 h-0.5 rounded-full"
                      transition={{
                        type: 'spring',
                        stiffness: 380,
                        damping: 30,
                      }}
                    />
                  ) : null}
                </button>
              )
            })}
          </div>

          <div className="relative w-full sm:w-72">
            <HugeiconsIcon
              icon={Search01Icon}
              className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
              strokeWidth={1.8}
            />
            <Input
              type="search"
              value={params.q}
              onChange={(e) =>
                void setParams({ q: e.target.value || null, page: 1 })
              }
              placeholder="Search"
              aria-label="Search events"
              className="h-10 w-full pl-9"
            />
          </div>
        </div>

        <div className="border-border/60 bg-background flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border shadow-sm shadow-black/[0.02]">
          <div className="min-h-0 w-full flex-1 [scrollbar-width:none] overflow-auto [&::-webkit-scrollbar]:hidden">
            <table className="w-full min-w-[960px] table-auto">
              <thead className="bg-primary/5">
                <tr className="text-muted-foreground text-xs font-semibold tracking-wider uppercase select-none">
                  <SortableHeader
                    field="name"
                    sort={params.sort}
                    dir={params.dir}
                    onSort={handleSort}
                  >
                    Event Details
                  </SortableHeader>
                  <SortableHeader
                    field="date"
                    sort={params.sort}
                    dir={params.dir}
                    onSort={handleSort}
                  >
                    Date
                  </SortableHeader>
                  <SortableHeader
                    field="location"
                    sort={params.sort}
                    dir={params.dir}
                    onSort={handleSort}
                  >
                    Location
                  </SortableHeader>
                  <SortableHeader
                    field="status"
                    sort={params.sort}
                    dir={params.dir}
                    onSort={handleSort}
                  >
                    Status
                  </SortableHeader>
                  <SortableHeader
                    field="sales"
                    sort={params.sort}
                    dir={params.dir}
                    onSort={handleSort}
                  >
                    Ticket Sales
                  </SortableHeader>
                  <th className="px-5 py-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-border/60 divide-y">
                {listQuery.isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <p className="text-muted-foreground text-sm">
                        Loading events…
                      </p>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <p className="text-muted-foreground text-sm">
                        {params.q || params.tab !== 'all'
                          ? 'No events match your filters.'
                          : 'No events yet — create your first one.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  rows.map((ev) => (
                    <EventRow
                      key={ev.id}
                      ev={ev}
                      onArchive={() => archiveMutation.mutate({ id: ev.id })}
                      onDelete={() => {
                        if (
                          confirm(
                            `Delete "${ev.title}"? This cannot be undone.`
                          )
                        ) {
                          deleteMutation.mutate({ id: ev.id })
                        }
                      }}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Pagination
          total={total}
          current={current}
          totalPages={totalPages}
          onPage={(p) => void setParams({ page: p })}
        />
      </div>
    </div>
  )
}

function SortableHeader({
  field,
  sort,
  dir,
  onSort,
  children,
}: {
  field: SortField
  sort: SortField
  dir: SortDir
  onSort: (field: SortField) => void
  children: React.ReactNode
}) {
  const active = sort === field
  return (
    <th className="px-5 py-4 text-left">
      <button
        type="button"
        onClick={() => onSort(field)}
        aria-sort={
          active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'
        }
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase transition-colors',
          active
            ? 'text-primary'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <span>{children}</span>
        {active ? (
          <HugeiconsIcon
            icon={dir === 'asc' ? ArrowUp01Icon : ArrowDown01Icon}
            className="size-3.5"
            strokeWidth={2.2}
          />
        ) : null}
      </button>
    </th>
  )
}

type EventRowData = {
  id: string
  slug: string
  title: string
  eventDate: string | null
  endDate: string | null
  location: string
  status: EventStatus
  sold: number
  total: number
}

function EventRow({
  ev,
  onArchive,
  onDelete,
}: {
  ev: EventRowData
  onArchive: () => void
  onDelete: () => void
}) {
  const detailHref = `/org/events/${ev.id}`
  const pct =
    ev.total > 0 ? Math.min(100, Math.round((ev.sold / ev.total) * 100)) : 0

  return (
    <tr className="text-sm">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
            {initialsFromTitle(ev.title)}
          </div>
          <span className="text-foreground font-semibold">{ev.title}</span>
        </div>
      </td>
      <td className="text-foreground px-5 py-4 whitespace-nowrap">
        {formatEventDate(ev.eventDate, ev.endDate)}
      </td>
      <td className="text-foreground px-5 py-4 whitespace-nowrap">
        {ev.location}
      </td>
      <td className="px-5 py-4">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
            STATUS_TONE[ev.status]
          )}
        >
          {STATUS_LABEL[ev.status]}
        </span>
      </td>
      <td className="px-5 py-4">
        <div className="flex min-w-[180px] flex-col gap-1.5">
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>
              {formatNumber(ev.sold)} / {formatNumber(ev.total)} sold
            </span>
            <span className="text-foreground font-semibold">{pct}%</span>
          </div>
          <div className="bg-muted relative h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="bg-foreground absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <RowActions
          status={ev.status}
          slug={ev.slug}
          detailHref={detailHref}
          onArchive={onArchive}
          onDelete={onDelete}
        />
      </td>
    </tr>
  )
}

function RowActions({
  status,
  slug,
  detailHref,
  onArchive,
  onDelete,
}: {
  status: EventStatus
  slug: string
  detailHref: string
  onArchive: () => void
  onDelete: () => void
}) {
  // Only an event with a public page is worth copying a link to. A draft or
  // one still in review resolves to nothing, so offering the link there would
  // hand the organizer an address that 404s for whoever they sent it to.
  const isPublic = status === 'upcoming' || status === 'archived'

  async function copyLink() {
    const path = publicEventPath(slug)
    const url =
      typeof window === 'undefined' ? path : `${window.location.origin}${path}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy the link', { description: url })
    }
  }
  if (status === 'draft') {
    return (
      <div className="flex items-center gap-1">
        <IconAction
          href={detailHref}
          label="Edit draft"
          icon={Edit02Icon}
          tone="primary"
        />
        <IconAction
          label="Delete draft"
          icon={Delete02Icon}
          tone="danger"
          onClick={onDelete}
        />
      </div>
    )
  }
  if (status === 'archived') {
    return (
      <div className="flex items-center gap-1">
        <IconAction
          href={detailHref}
          label="View event"
          icon={ViewIcon}
          tone="primary"
        />
        <IconAction
          label="Copy link"
          icon={Copy01Icon}
          tone="primary"
          onClick={copyLink}
        />
        <IconAction
          label="Delete event"
          icon={Delete02Icon}
          tone="danger"
          onClick={onDelete}
        />
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1">
      <IconAction
        href={detailHref}
        label="View event"
        icon={ViewIcon}
        tone="primary"
      />
      {isPublic ? (
        <IconAction
          label="Copy link"
          icon={Copy01Icon}
          tone="primary"
          onClick={copyLink}
        />
      ) : null}
      {status === 'upcoming' ? (
        <IconAction
          label="Archive event"
          icon={Delete02Icon}
          tone="danger"
          onClick={onArchive}
        />
      ) : null}
    </div>
  )
}

function IconAction({
  icon,
  label,
  tone,
  href,
  onClick,
}: {
  icon: Parameters<typeof HugeiconsIcon>[0]['icon']
  label: string
  tone: 'primary' | 'danger'
  href?: string
  onClick?: () => void
}) {
  const className = cn(
    'focus-visible:ring-primary/40 inline-flex size-8 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2',
    tone === 'primary'
      ? 'text-primary hover:bg-primary/10'
      : 'text-destructive hover:bg-destructive/10'
  )
  if (href) {
    return (
      <Link href={href} aria-label={label} className={className}>
        <HugeiconsIcon icon={icon} className="size-4" strokeWidth={1.8} />
      </Link>
    )
  }
  return (
    <button
      type="button"
      aria-label={label}
      className={className}
      onClick={onClick}
    >
      <HugeiconsIcon icon={icon} className="size-4" strokeWidth={1.8} />
    </button>
  )
}

function Pagination({
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

  const start = total === 0 ? 0 : (current - 1) * EVENTS_PAGE_SIZE + 1
  const end = Math.min(current * EVENTS_PAGE_SIZE, total)

  return (
    <div className="flex shrink-0 flex-col items-start justify-between gap-4 pt-2 sm:flex-row sm:items-center">
      <p className="text-muted-foreground text-xs sm:text-sm">
        {total === 0 ? 'No events' : `Showing ${start}–${end} of ${total}`}
        <span className="hidden sm:inline">{total === 0 ? '' : ' events'}</span>
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

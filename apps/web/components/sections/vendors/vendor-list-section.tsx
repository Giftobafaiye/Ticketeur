'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import {
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  useQueryStates,
} from 'nuqs'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  FilterIcon,
  Search01Icon,
} from '@hugeicons/core-free-icons'

import { cn } from '@ticketur/ui/lib/utils'
import { Button } from '@ticketur/ui/components/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@ticketur/ui/components/popover'
import { VendorMarketplaceCard } from '@/components/cards/vendor-marketplace-card'
import { MobileFilterDrawer } from '@/components/sections/vendors/mobile-filter-drawer'
import {
  VendorFilters,
  type VendorFiltersValue,
} from '@/components/sections/vendors/vendor-filters'
import { useTRPC } from '@/lib/trpc'

const CATEGORY_CHIPS = [
  { label: 'All Categories', value: 'all' },
  { label: 'Catering', value: 'Catering' },
  { label: 'AV & Sound', value: 'AV & Sound' },
  { label: 'Security', value: 'Security' },
  { label: 'Logistics', value: 'Logistics' },
  { label: 'Merch', value: 'Merch' },
  { label: 'Photography', value: 'Photography' },
  { label: 'Entertainment', value: 'Entertainment' },
  { label: 'Decor & Floral', value: 'Decor & Floral' },
] as const

const PAGE_SIZE = 8
const VENDOR_PLACEHOLDER = '/vendor-placeholder.svg'

export function VendorListSection() {
  const trpc = useTRPC()
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const [state, setState] = useQueryStates(
    {
      q: parseAsString.withDefault(''),
      category: parseAsString.withDefault('all'),
      location: parseAsString.withDefault(''),
      minRating: parseAsFloat.withDefault(0),
      page: parseAsInteger.withDefault(1),
    },
    { shallow: true, clearOnDefault: true }
  )

  const filterValues: VendorFiltersValue = {
    minRating: state.minRating,
    location: state.location,
  }

  const patchFilters = (patch: Partial<VendorFiltersValue>) => {
    setState({ ...patch, page: 1 })
  }

  const clearFilters = () => {
    setState({ minRating: null, location: null, page: 1 })
  }

  const activeFilterCount =
    (state.minRating > 0 ? 1 : 0) + (state.location.trim() !== '' ? 1 : 0)

  const listQuery = useQuery(
    trpc.public.vendors.list.queryOptions({
      q: state.q,
      category: state.category,
      location: state.location,
      minRating: state.minRating,
      page: state.page,
      pageSize: PAGE_SIZE,
    })
  )

  const data = listQuery.data
  const total = data?.total ?? 0
  const pageItems = data?.rows ?? []
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(state.page, totalPages)

  return (
    <section
      aria-labelledby="vendor-list-title"
      className="w-full px-5 py-10 md:px-10 md:py-16"
    >
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8 md:gap-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-2.5"
        >
          <h1
            id="vendor-list-title"
            className="font-heading text-foreground text-3xl font-bold tracking-tight md:text-[40px] md:leading-[1.15]"
          >
            Vendors Marketplace
          </h1>
          <p className="text-muted-foreground text-base">
            Discover and hire verified vendors for your next event. Every vendor
            is curated to ensure your production is world-class.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-3 md:flex-row md:items-center"
        >
          <label className="border-border bg-background focus-within:border-primary flex h-12 flex-1 items-center gap-2 rounded-lg border px-4">
            <HugeiconsIcon
              icon={Search01Icon}
              className="text-muted-foreground size-4 shrink-0"
              strokeWidth={1.6}
            />
            <input
              type="search"
              value={state.q}
              onChange={(e) => setState({ q: e.target.value || null, page: 1 })}
              placeholder="Search by name or service specialization..."
              className="text-foreground placeholder:text-muted-foreground w-full min-w-0 bg-transparent text-sm outline-none md:text-base"
            />
          </label>
          <Button
            size="default"
            className="h-12 px-8 text-base md:h-12"
            onClick={() => setState({ page: 1 })}
          >
            Search
          </Button>

          {/* Desktop: lightweight popover next to search. A full-screen
              overlay isn't warranted for two fields. */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                className="hidden h-12 shrink-0 gap-2 px-6 text-base md:inline-flex"
              >
                <HugeiconsIcon
                  icon={FilterIcon}
                  className="size-4"
                  strokeWidth={1.8}
                />
                Filter
                <FilterCountBadge count={activeFilterCount} />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-4">
              <div className="mb-3 flex items-center justify-between gap-4">
                <span className="font-heading text-foreground text-base font-semibold">
                  Filters
                </span>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-primary hover:text-primary-hover text-xs font-medium transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <VendorFilters values={filterValues} onChange={patchFilters} />
            </PopoverContent>
          </Popover>

          {/* Mobile: icon-only trigger opens the custom motion bottom-sheet
              below — never @ticketur/ui's Sheet/Drawer/Dialog. */}
          <button
            type="button"
            aria-label="Filters"
            onClick={() => setMobileFilterOpen(true)}
            className="bg-primary text-primary-foreground relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg md:hidden"
          >
            <HugeiconsIcon
              icon={FilterIcon}
              className="size-5"
              strokeWidth={1.8}
            />
            {activeFilterCount > 0 && (
              <span className="border-background text-primary absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full border bg-white text-[10px] font-semibold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18, duration: 0.35 }}
          className="-mx-5 flex [scrollbar-width:none] gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {CATEGORY_CHIPS.map((chip) => {
            const active = state.category === chip.value
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() =>
                  setState({
                    category: chip.value === 'all' ? null : chip.value,
                    page: 1,
                  })
                }
                className={cn(
                  'relative shrink-0 rounded-full border px-4 py-2 text-xs font-medium tracking-wide whitespace-nowrap uppercase transition-colors md:text-sm',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-primary'
                )}
              >
                {chip.label}
              </button>
            )
          })}
        </motion.div>

        <AnimatePresence initial={false}>
          {(state.minRating > 0 || state.location.trim() !== '') && (
            <motion.div
              key="active-vendor-filters"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="flex flex-wrap items-center gap-3 overflow-hidden"
            >
              <span className="font-heading text-foreground text-base font-medium md:text-lg">
                Filters;
              </span>
              {state.minRating > 0 && (
                <FilterChip
                  label={`Rating: ${state.minRating.toFixed(1)} - 5.0`}
                  onRemove={() => setState({ minRating: null, page: 1 })}
                />
              )}
              {state.location.trim() !== '' && (
                <FilterChip
                  label={`Location: ${state.location}`}
                  onRemove={() => setState({ location: null, page: 1 })}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!listQuery.isLoading &&
          (state.q.trim() ? (
            <p className="font-heading text-foreground text-2xl font-semibold tracking-tight md:text-4xl">
              Result for &ldquo;{state.q.trim()}&rdquo; ({total} vendor
              {total === 1 ? '' : 's'} found)
            </p>
          ) : (
            <p className="text-foreground text-lg font-semibold md:text-xl">
              {total} Vendor{total === 1 ? '' : 's'}
            </p>
          ))}

        {listQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-muted h-64 animate-pulse rounded-2xl"
              />
            ))}
          </div>
        ) : pageItems.length === 0 ? (
          <div className="border-border bg-muted/20 flex min-h-65 flex-col items-center justify-center rounded-2xl border border-dashed p-10 text-center">
            <p className="font-heading text-foreground text-lg font-semibold">
              No vendors match your search
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Try clearing the search or picking a different category.
            </p>
          </div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {pageItems.map((vendor, i) => (
                <motion.div
                  key={vendor.id + currentPage}
                  layout
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{
                    delay: i * 0.05,
                    duration: 0.35,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <VendorMarketplaceCard
                    id={vendor.id}
                    name={vendor.businessName ?? 'Vendor'}
                    category={vendor.businessCategory}
                    description={
                      vendor.tagline ??
                      vendor.businessDescription ??
                      vendor.businessCategory ??
                      ''
                    }
                    imageUrl={vendor.image ?? VENDOR_PLACEHOLDER}
                    location={vendor.location}
                    avgRating={vendor.avgRating}
                    reviewCount={vendor.reviewCount}
                    href={`/vendors/${vendor.id}`}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {totalPages > 1 && (
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            onChange={(p) => setState({ page: p })}
          />
        )}

        <div className="flex flex-col items-start gap-8 rounded-3xl bg-[#31156b] p-8 md:flex-row md:items-end md:justify-between md:gap-10 md:p-20">
          <div className="flex flex-col gap-4 text-[#ededed] md:max-w-[560px] md:gap-8">
            <h2 className="font-heading text-3xl font-bold md:text-4xl">
              Are you a Vendor?
            </h2>
            <p className="text-sm md:text-base">
              Join 500+ vetted vendors on Ticketeur and connect with thousands
              of event organizers looking for your services.
            </p>
          </div>
          <Button size="xl" asChild className="w-full md:w-auto">
            <Link href="/vendors/apply">Join as a Vendor</Link>
          </Button>
        </div>
      </div>

      <MobileFilterDrawer
        open={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        values={filterValues}
        onApply={(next) =>
          setState({
            minRating: next.minRating > 0 ? next.minRating : null,
            location: next.location || null,
            page: 1,
          })
        }
      />
    </section>
  )
}

function FilterCountBadge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="bg-primary text-primary-foreground inline-flex size-5 items-center justify-center rounded-full text-[11px] font-semibold">
      {count}
    </span>
  )
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string
  onRemove: () => void
}) {
  return (
    <span className="border-border bg-muted/60 text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <HugeiconsIcon
          icon={Cancel01Icon}
          className="size-3.5"
          strokeWidth={2}
        />
      </button>
    </span>
  )
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (p: number) => void
}) {
  const pages = getPageList(page, totalPages)
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-2 pt-2"
    >
      <PageButton
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        ariaLabel="Previous page"
      >
        <HugeiconsIcon
          icon={ArrowLeft01Icon}
          className="size-4"
          strokeWidth={2}
        />
      </PageButton>
      {pages.map((p, i) =>
        p === '…' ? (
          <span
            key={`dots-${i}`}
            className="text-muted-foreground px-1 text-sm"
          >
            …
          </span>
        ) : (
          <PageButton
            key={p}
            active={p === page}
            onClick={() => onChange(p)}
            ariaLabel={`Page ${p}`}
          >
            {p}
          </PageButton>
        )
      )}
      <PageButton
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        ariaLabel="Next page"
      >
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          className="size-4"
          strokeWidth={2}
        />
      </PageButton>
    </nav>
  )
}

function PageButton({
  active,
  disabled,
  onClick,
  ariaLabel,
  children,
}: {
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  ariaLabel?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex size-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-foreground hover:border-primary hover:text-primary',
        disabled && 'pointer-events-none opacity-40'
      )}
    >
      {children}
    </button>
  )
}

function getPageList(page: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '…')[] = [1]
  if (page > 3) pages.push('…')
  const start = Math.max(2, page - 1)
  const end = Math.min(total - 1, page + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (page < total - 2) pages.push('…')
  pages.push(total)
  return pages
}

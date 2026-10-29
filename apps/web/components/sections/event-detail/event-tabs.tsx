'use client'

import { AnimatePresence, motion } from 'motion/react'
import { parseAsStringLiteral, useQueryState } from 'nuqs'

import { cn } from '@ticketur/ui/lib/utils'
import { Button } from '@ticketur/ui/components/button'

import { DetailsTab } from '@/components/sections/event-detail/details-tab'
import { TicketsTab } from '@/components/sections/event-detail/tickets-tab'
import {
  VendorsTab,
  type EventVendor,
} from '@/components/sections/event-detail/vendors-tab'
import type { EventDetailData } from '@/components/sections/event-detail/types'

const TABS = ['details', 'tickets', 'vendors'] as const
type TabKey = (typeof TABS)[number]

const TABS_SECTION_ID = 'event-tabs'

function useEventTab() {
  return useQueryState('tab', parseAsStringLiteral(TABS).withDefault('details'))
}

// What every "Buy Ticket" on the event page does: open the Tickets tab and
// bring it into view. They used to be links to ?tab=tickets, which switched
// the tab out of sight below the hero and so looked like nothing happened.
export function useOpenTickets() {
  const [, setTab] = useEventTab()
  return () => {
    void setTab('tickets')
    document
      .getElementById(TABS_SECTION_ID)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

const TAB_LABELS: Record<TabKey, string> = {
  details: 'Details',
  tickets: 'Tickets',
  vendors: 'Vendors',
}

export function EventTabs({
  event,
  vendors,
}: {
  event: EventDetailData
  vendors: EventVendor[]
}) {
  const [tab, setTab] = useEventTab()
  const openTickets = useOpenTickets()

  return (
    <section
      id={TABS_SECTION_ID}
      aria-label="Event details"
      className="w-full scroll-mt-20 px-5 md:px-10"
    >
      <div className="mx-auto max-w-[1440px] pt-10 pb-6 md:pt-16 md:pb-10">
        <div role="tablist" className="border-b border-[#c6c6c6]">
          <div className="flex items-center gap-6 md:gap-8">
            {TABS.map((t) => {
              const active = tab === t
              return (
                <button
                  key={t}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t)}
                  className={cn(
                    'relative -mb-px px-2 pb-4 text-base font-semibold transition-colors outline-none',
                    active
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {TAB_LABELS[t]}
                  {active && (
                    <motion.span
                      layoutId="event-tab-underline"
                      className="bg-primary absolute inset-x-0 -bottom-px h-[3px] rounded-full"
                      transition={{
                        type: 'spring',
                        stiffness: 420,
                        damping: 32,
                      }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            delay: 0.15,
            duration: 0.35,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="fixed top-[84px] right-4 z-30 md:hidden"
        >
          <Button
            size="default"
            className="shadow-primary/30 shadow-lg"
            onClick={openTickets}
          >
            {event.soldOut ? 'View tickets' : 'Buy Ticket'}
          </Button>
        </motion.div>

        <div className="pt-8 md:pt-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {tab === 'details' && <DetailsTab event={event} />}
              {tab === 'tickets' && <TicketsTab event={event} />}
              {tab === 'vendors' && <VendorsTab vendors={vendors} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

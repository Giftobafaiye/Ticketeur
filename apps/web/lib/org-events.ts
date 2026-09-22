export type EventStatus =
  'upcoming' | 'in-review' | 'draft' | 'archived' | 'suspended'

export type OrgEvent = {
  id: string
  name: string
  initials: string
  date: string
  dateMs: number
  location: string
  status: EventStatus
  sold: number
  total: number
}

function mk(
  id: string,
  name: string,
  initials: string,
  isoDate: string,
  location: string,
  status: EventStatus,
  sold: number,
  total: number
): OrgEvent {
  return {
    id,
    name,
    initials,
    date: new Date(isoDate).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }),
    dateMs: new Date(isoDate).getTime(),
    location,
    status,
    sold,
    total,
  }
}

export const ORG_EVENTS: OrgEvent[] = [
  mk(
    '1',
    'Tech Innovation Summit 2024',
    'TI',
    '2024-10-24',
    'London, United Kingdom',
    'upcoming',
    1240,
    2000
  ),
  mk(
    '2',
    'Product Launch Gala',
    'PL',
    '2024-12-15',
    'Paris, France',
    'in-review',
    0,
    250
  ),
  mk(
    '3',
    'Design Thinking Workshop',
    'DT',
    '2024-11-12',
    'Online Event',
    'draft',
    0,
    50
  ),
  mk(
    '4',
    'Global Startup Expo',
    'GS',
    '2024-08-05',
    'New York, USA',
    'archived',
    500,
    500
  ),
  mk(
    '5',
    'Design Thinking Workshop',
    'DT',
    '2024-11-12',
    'Online Event',
    'draft',
    0,
    50
  ),
  mk(
    '6',
    'Product Launch Gala',
    'PL',
    '2024-12-15',
    'Paris, France',
    'upcoming',
    320,
    400
  ),
  mk(
    '7',
    'Global Startup Expo',
    'GS',
    '2024-08-05',
    'New York, USA',
    'in-review',
    0,
    1200
  ),
  mk(
    '8',
    'Lagos Tech Fest',
    'LT',
    '2025-02-10',
    'Lagos, Nigeria',
    'upcoming',
    800,
    1500
  ),
  mk(
    '9',
    'Summer Vibes Concert',
    'SV',
    '2024-07-20',
    'Los Angeles, USA',
    'archived',
    950,
    1000
  ),
  mk(
    '10',
    'Foodie Festival',
    'FF',
    '2025-03-05',
    'Berlin, Germany',
    'draft',
    0,
    300
  ),
  mk(
    '11',
    'Synthwave Summer Night',
    'SY',
    '2025-06-14',
    'Miami, USA',
    'upcoming',
    600,
    1200
  ),
  mk(
    '12',
    'Retro Night Rewind',
    'RN',
    '2024-09-22',
    'Toronto, Canada',
    'archived',
    420,
    420
  ),
  mk(
    '13',
    'AI 2 UX Conference',
    'AI',
    '2025-04-18',
    'Amsterdam, Netherlands',
    'in-review',
    0,
    800
  ),
  mk(
    '14',
    'Jazz Under The Stars',
    'JZ',
    '2024-09-10',
    'Cape Town, South Africa',
    'archived',
    800,
    800
  ),
  mk(
    '15',
    'Founder Office Hours',
    'FO',
    '2025-05-02',
    'Online Event',
    'upcoming',
    95,
    200
  ),
  mk(
    '16',
    'Photography Pop-up',
    'PP',
    '2025-07-08',
    'Tokyo, Japan',
    'draft',
    0,
    150
  ),
  mk(
    '17',
    'Climate Forum',
    'CF',
    '2025-09-30',
    'Stockholm, Sweden',
    'upcoming',
    410,
    1000
  ),
  mk(
    '18',
    'Indie Game Showcase',
    'IG',
    '2024-12-01',
    'Seoul, South Korea',
    'in-review',
    0,
    600
  ),
  mk(
    '19',
    'Crypto Builders Meetup',
    'CB',
    '2025-01-25',
    'Singapore',
    'archived',
    220,
    220
  ),
  mk(
    '20',
    'Designers Beach Day',
    'DB',
    '2025-08-16',
    'Lisbon, Portugal',
    'draft',
    0,
    120
  ),
  mk(
    '21',
    'Open Source Day',
    'OS',
    '2025-10-12',
    'Online Event',
    'upcoming',
    1500,
    5000
  ),
  mk(
    '22',
    'Founders Breakfast',
    'FB',
    '2025-03-19',
    'Nairobi, Kenya',
    'upcoming',
    75,
    100
  ),
  mk(
    '23',
    'Marketing Mastermind',
    'MM',
    '2025-05-28',
    'Sydney, Australia',
    'in-review',
    0,
    450
  ),
  mk(
    '24',
    'Year-End Industry Mixer',
    'YE',
    '2025-12-12',
    'Dubai, UAE',
    'draft',
    0,
    350
  ),
]

export const EVENTS_PAGE_SIZE = 10

export const GUESTS_PAGE_SIZE = 20

export const STATUS_LABEL: Record<EventStatus, string> = {
  upcoming: 'Upcoming',
  'in-review': 'In Review',
  draft: 'Draft',
  archived: 'Archived',
  suspended: 'Suspended',
}

export function findEventById(id: string): OrgEvent | undefined {
  return ORG_EVENTS.find((e) => e.id === id)
}

export function eventCode(id: string): string {
  return `EVT-${id.padStart(5, '0')}`
}

export type TicketTier = {
  name: string
  tier: string
  sold: number
  total: number
  price: string
}

export type VendorEntry = {
  name: string
  category: string
  description: string
  image: string
  status: 'verified' | 'pending'
}

export type EventDetail = {
  title: string
  code: string
  description: string
  date: string
  weekday: string
  time: string
  location: string
  status: EventStatus
  revenue: string
  sold: number
  total: number
  pct: number
  tiers: TicketTier[]
  vendors: VendorEntry[]
  hasEnded: boolean
}

const FALLBACK_DESCRIPTION =
  "Join the brightest minds in tech for a day of innovation, networking, and expert-led sessions. This year's conference focuses on the intersection of Artificial Intelligence and Sustainable Infrastructure. Keynote speakers include industry pioneers from leading global tech giants."

const FALLBACK_VENDORS: VendorEntry[] = [
  {
    name: 'Neon Bites',
    category: 'Food & Drink',
    description:
      'Serving award-winning wagyu sliders and truffle fries throughout the event.',
    image: '/event-detail/neon-bites.jpg',
    status: 'verified',
  },
  {
    name: 'Glow Threads',
    category: 'Apparel',
    description:
      'Exclusive LED-integrated apparel and limited edition artist collaborations.',
    image: '/event-detail/glow-threads.jpg',
    status: 'verified',
  },
  {
    name: 'Liquid Dreams',
    category: 'Beverages',
    description:
      'Experience our signature “Neon Rush” & other molecular delights.',
    image: '/event-detail/liquid-dreams.jpg',
    status: 'verified',
  },
  {
    name: 'Prism Arts',
    category: 'Decor',
    description:
      'Browse and purchase unique digital collectibles and interactive physical pieces.',
    image: '/event-detail/prism-arts.jpg',
    status: 'pending',
  },
]

export function buildEventDetail(ev: OrgEvent): EventDetail {
  const totalTickets = ev.total > 0 ? ev.total : 1000
  const sold = ev.sold

  const isDraft = ev.status === 'draft'
  const isInReview = ev.status === 'in-review'
  const isArchived = ev.status === 'archived'

  const tiers: TicketTier[] = isDraft
    ? [
        {
          name: 'Early Bird Pass',
          tier: 'Tier 1',
          sold: 0,
          total: 200,
          price: '₦10,000',
        },
      ]
    : [
        {
          name: 'Early Bird Pass',
          tier: 'Tier 1',
          sold: isArchived ? 250 : isInReview ? 0 : Math.min(250, sold),
          total: 250,
          price: '₦10,000',
        },
        {
          name: 'General Admission',
          tier: 'Tier 2',
          sold: isArchived
            ? 600
            : isInReview
              ? 0
              : Math.min(600, Math.max(0, sold - 250)),
          total: 600,
          price: '₦15,000',
        },
        {
          name: 'VIP Networking Pass',
          tier: 'Tier 3',
          sold: isArchived
            ? 150
            : isInReview
              ? 0
              : Math.min(150, Math.max(0, sold - 850)),
          total: 150,
          price: '₦30,000',
        },
      ]

  const computedSold = isArchived
    ? totalTickets
    : isDraft || isInReview
      ? 0
      : sold
  const pct =
    totalTickets > 0
      ? Math.min(100, Math.round((computedSold / totalTickets) * 100))
      : 0
  const revenueValue = computedSold * 282
  const revenue = `₦${revenueValue.toLocaleString('en-US')}`

  return {
    title: ev.name,
    code: eventCode(ev.id),
    description: FALLBACK_DESCRIPTION,
    date: ev.date,
    weekday: new Date(ev.dateMs).toLocaleDateString('en-US', {
      weekday: 'long',
    }),
    time: '09:00 AM – 06:00 PM',
    location:
      ev.location === 'Online Event'
        ? 'Online Event'
        : `Main Ballroom, ${ev.location}`,
    status: ev.status,
    revenue,
    sold: computedSold,
    total: totalTickets,
    pct,
    tiers,
    vendors: FALLBACK_VENDORS,
    hasEnded: isArchived,
  }
}

export const STATUS_TONE: Record<EventStatus, string> = {
  upcoming:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  'in-review': 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
  draft: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  archived: 'bg-muted text-muted-foreground',
  suspended: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
}

import { z } from 'zod'

import { EVENT_CATEGORIES } from '@ticketur/api/lib/event-categories'

export const FEATURE_OPTIONS = [
  'Live DJ Sets',
  'Laser Show',
  'Open VIP Bar',
  'Mascots',
  'Games',
  'Food & Drink',
  'Workshops',
  'Networking',
  'Live Music',
  'Photo Booth',
] as const

export const ticketTierSchema = z.object({
  // Present only when editing an existing event — carries the tier's id so the
  // server can reconcile edits against already-sold tickets. Absent for new
  // tiers (both on create and when adding a tier during an edit).
  id: z.string().optional(),
  // Tickets already sold for this tier (edit mode only). Lets the form guard
  // against removing a sold tier or dropping quantity below what's sold; the
  // server enforces the same rules authoritatively.
  sold: z.number().int().min(0).optional(),
  name: z.string().trim().min(1, 'Tier name required'),
  quantity: z.number().int().min(1, 'Min 1 ticket'),
  price: z.number().min(0, 'Price must be 0 or more'),
})

export const externalVendorSchema = z.object({
  businessName: z.string().trim().min(1, 'Business name required'),
  contactName: z.string().trim().min(1, 'Contact name required'),
  email: z.email('Enter a valid email'),
  phone: z.string().trim().min(1, 'Phone number required'),
})

export const createEventSchema = z
  .object({
    title: z.string().trim().min(1, 'Event title required'),
    description: z
      .string()
      .trim()
      .min(10, 'Add at least 10 characters describing the event'),
    date: z.string().min(1, 'Date required'),
    // ISO end date for multi-day events. Null means single-day; the event
    // runs only on `date`. Always present in form values (kept null when
    // the user picks the Single-day toggle) so RHF types stay stable.
    endDate: z.string().nullable(),
    time: z.string().min(1, 'Time required'),
    location: z.string().trim().min(1, 'Location required'),
    // Nullable so the form can start empty (and so an event from before
    // categories existed loads), but it has to be picked before saving: it is
    // what buyers filter the marketplace by.
    category: z
      .enum(EVENT_CATEGORIES)
      .nullable()
      .refine((v) => Boolean(v), 'Pick a category'),
    features: z.array(z.string().trim()),
    tiers: z.array(ticketTierSchema).min(1, 'At least one ticket tier'),
    assignedVendorIds: z.array(z.string()),
    externalInvites: z.array(externalVendorSchema),
  })
  .refine((v) => !v.endDate || v.endDate >= v.date, {
    path: ['endDate'],
    message: 'End date must be on or after the start date',
  })

export type TicketTierValues = z.infer<typeof ticketTierSchema>
export type ExternalVendorValues = z.infer<typeof externalVendorSchema>
export type CreateEventValues = z.infer<typeof createEventSchema>

export const CREATE_EVENT_DEFAULTS: CreateEventValues = {
  title: '',
  description: '',
  date: '',
  endDate: null,
  time: '',
  location: '',
  category: null,
  features: [],
  tiers: [{ name: 'Early Bird', quantity: 100, price: 5000 }],
  assignedVendorIds: [],
  externalInvites: [],
}

export type RegisteredVendor = {
  id: string
  name: string
  category: string
  description: string
  status: 'verified' | 'pending'
}

export const REGISTERED_VENDORS: RegisteredVendor[] = [
  {
    id: 'neon-bites',
    name: 'Neon Bites',
    category: 'Food & Drink',
    description:
      'Serving award-winning wagyu sliders and truffle fries throughout the event.',
    status: 'verified',
  },
  {
    id: 'glow-threads',
    name: 'Glow Threads',
    category: 'Apparel',
    description:
      'Exclusive LED-integrated apparel and limited edition artist collaborations.',
    status: 'verified',
  },
  {
    id: 'liquid-dreams',
    name: 'Liquid Dreams',
    category: 'Beverages',
    description:
      'Experience our signature “Neon Rush” & other molecular delights.',
    status: 'verified',
  },
  {
    id: 'prism-arts',
    name: 'Prism Arts',
    category: 'Decor',
    description:
      'Browse and purchase unique digital collectibles and interactive physical pieces.',
    status: 'pending',
  },
  {
    id: 'aurora-stage',
    name: 'Aurora Stage',
    category: 'Entertainment',
    description:
      'Touring stage-design specialists with bespoke visual installations.',
    status: 'verified',
  },
  {
    id: 'pulse-print',
    name: 'Pulse Print',
    category: 'Merchandise',
    description:
      'Custom event merch, on-site printing, and limited drops for fans.',
    status: 'verified',
  },
]

export const VENDOR_CATEGORIES = [
  'All Categories',
  'Food & Drink',
  'Apparel',
  'Beverages',
  'Decor',
  'Entertainment',
  'Merchandise',
] as const

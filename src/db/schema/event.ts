import {
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
} from 'drizzle-orm/pg-core'
import { BaseEntity, createBaseTable } from './base-table'
import { users } from './user'

export const eventTypes = ['admin', 'normal'] as const
export type EventType = (typeof eventTypes)[number]

export const venueTypes = ['admin', 'normal'] as const
export type VenueType = (typeof venueTypes)[number]

export const events = createBaseTable('events', {
  user_id: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: varchar('title', { length: 100 }).notNull(),
  category: varchar('category', { length: 100 }),
  description: text('description'),
  image: text('image'),
  event_type: varchar('event_type', { length: 20 }),
  venue_type: varchar('venue_type', { length: 20 }),
  event_start_date: timestamp('event_start_date', {
    mode: 'date',
    withTimezone: true,
  }).notNull(),
  event_end_date: timestamp('event_end_date', {
    mode: 'date',
    withTimezone: true,
  }).notNull(),
  address: text('address'),
})

export type Event = typeof events.$inferSelect & BaseEntity
export type NewEvent = typeof events.$inferInsert

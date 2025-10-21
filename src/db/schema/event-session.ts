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
import { events } from './event'


export const eventSessions = createBaseTable('event_sessions', {
  created_by: uuid('created_by')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  event_id: uuid('event_id')
    .references(() => events.id, { onDelete: 'cascade' })
    .notNull(),
  title: varchar('title', { length: 100 }).notNull(),
  track: varchar('track', { length: 100 }).notNull(),
  start: timestamp('start', {
    mode: 'date',
    withTimezone: true,
  }).notNull(),
  end: timestamp('end', {
    mode: 'date',
    withTimezone: true,
  }).notNull(),
  speaker_name: varchar('speaker_name', { length: 100 }),
  speaker_image: text('speaker_image'),
})

export type EventSession = typeof eventSessions.$inferSelect & BaseEntity
export type NewEventSession = typeof eventSessions.$inferInsert

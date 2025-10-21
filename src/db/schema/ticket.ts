import {
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  numeric,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { BaseEntity, createBaseTable } from './base-table'
import { users } from './user'
import { events } from './event'

//
export const tickets = createBaseTable('tickets', {
  created_by: uuid('created_by')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  event_id: uuid('event_id')
    .references(() => events.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  image: text('image'),
  price: numeric('price', { precision: 12, scale: 2 })
    .notNull()
    .default(sql`0`),
  currency: varchar('currency', { length: 3 }).notNull().default('NGN'),
  start: timestamp('start', {
    mode: 'date',
    withTimezone: true,
  }).notNull(),
  end: timestamp('end', {
    mode: 'date',
    withTimezone: true,
  }).notNull(),
  sold_out: boolean('sold_out').default(false),
  enable_sit_selection: boolean('enable_sit_selection').default(false),
  benefits: text('benefits')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
})

export type Ticket = typeof tickets.$inferSelect & BaseEntity
export type NewTicket = typeof tickets.$inferInsert

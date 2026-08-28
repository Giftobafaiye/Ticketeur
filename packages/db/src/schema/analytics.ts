import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

import { user } from './auth'

// ─── Vendor Profile Views ──────────────────────────────────────────────────

// One row per counted view of a vendor's public profile. Appended by
// public.vendors.recordView, which the vendor detail page calls once per
// browser session per vendor (a self-view by the vendor is skipped), so this
// is a lightly de-duplicated view log rather than a raw per-request hit
// counter. The vendor Analytics screens count rows within a date window.
export const vendorProfileViews = pgTable(
  'vendor_profile_views',
  {
    id: text('id').primaryKey(),
    vendorId: text('vendor_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    // The signed-in viewer, when there was one; null for anonymous views.
    viewerId: text('viewer_id').references(() => user.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('vendor_profile_views_vendor_idx').on(t.vendorId),
    // Window queries filter by vendor + a created_at range, then count.
    index('vendor_profile_views_vendor_created_idx').on(
      t.vendorId,
      t.createdAt
    ),
  ]
)

export const vendorProfileViewsRelations = relations(
  vendorProfileViews,
  ({ one }) => ({
    vendor: one(user, {
      fields: [vendorProfileViews.vendorId],
      references: [user.id],
      relationName: 'vendorProfileViews_vendor',
    }),
    viewer: one(user, {
      fields: [vendorProfileViews.viewerId],
      references: [user.id],
      relationName: 'vendorProfileViews_viewer',
    }),
  })
)

import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

import { user } from './auth'

// ─── Organizer payouts ──────────────────────────────────────────────────────
//
// Every naira a buyer pays lands in the platform's one Flutterwave account
// (checkout uses no split payments). An organizer's share of it is taken back
// out through these tables: they add a bank account, ask to withdraw, an admin
// approves, and the money goes out as a Flutterwave transfer or is paid by
// hand.
//
// ── What is NOT stored here: the balance ──
// What an organizer has earned is computed from the orders that already exist
// (packages/db/src/payouts/balance.ts): the organizer's share of every paid
// order on their events, which checkout froze on the order as subtotal minus
// discount. Copying it into a ledger would mean posting an entry from
// fulfilment, the most delicate path in the app, and back-filling every past
// sale. Instead the tables below record only what is new: withdrawals,
// adjustments an admin enters, and the accounts money goes to.
//
// ── Soft pointers ──
// `payouts.organizer_id` and `payout_adjustments.organizer_id` are NOT foreign
// keys, for the same reason `payment_discrepancies` keeps soft pointers: a
// record that money left the platform has to outlive the account it was paid
// to. Deleting a user cascades to their events and orders; it must not take
// the evidence of a payout with it. The names and bank details a reader needs
// are copied onto the row.

export type PayoutStatus =
  // The organizer asked; nobody has looked yet. The amount is already held
  // against their balance so it cannot be asked for twice.
  | 'pending_review'
  // An admin approved it. In `live` mode the transfer job picks it up; in
  // `manual` mode an admin pays it by hand and records that they did.
  | 'approved'
  // A transfer attempt has been sent to Flutterwave (or may have been — see
  // payout_transfers.status 'unconfirmed') and has not reached a final state.
  | 'processing'
  // The money left. Terminal.
  | 'paid'
  // The last transfer attempt failed definitively. The amount is released
  // back to the organizer's balance; an admin may retry, pay by hand or
  // reject.
  | 'failed'
  // An admin turned it down, with a reason. Terminal; the amount is released.
  | 'rejected'
  // The organizer withdrew the request before review. Terminal; released.
  | 'cancelled'

// How a paid payout was paid.
export type PayoutMethod = 'transfer' | 'manual'

export type PayoutAccountStatus = 'active' | 'retired'

export type PayoutTransferStatus =
  // Recorded BEFORE the call to Flutterwave, so a crash or a timeout leaves a
  // reference behind to look up. Stays here when the answer was ambiguous:
  // Flutterwave may or may not hold this transfer. Never resent.
  | 'unconfirmed'
  // Flutterwave accepted it and it is in flight.
  | 'pending'
  | 'successful'
  | 'failed'

export type PayoutAdjustmentKind =
  // Money the organizer was already given outside this system — a bank
  // transfer an admin made by hand before payouts existed. Always negative.
  | 'paid_outside'
  // Anything else an admin needs to correct, either way: a chargeback, a
  // goodwill credit, a mistake.
  | 'correction'

export type PayoutCodePurpose = 'add_account' | 'request_payout'

export type PayoutActorType = 'organizer' | 'admin' | 'system'

// ─── Bank accounts ──────────────────────────────────────────────────────────

export const payoutAccounts = pgTable(
  'payout_accounts',
  {
    id: text('id').primaryKey(),
    organizerId: text('organizer_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    // Flutterwave's bank code — what a transfer takes as `account_bank`.
    bankCode: text('bank_code').notNull(),
    bankName: text('bank_name').notNull(),
    // NUBAN, ten digits.
    accountNumber: text('account_number').notNull(),
    // The holder's name as Flutterwave's resolve call returned it when the
    // account was added. Never typed by the organizer.
    accountName: text('account_name').notNull(),
    status: text('status')
      .$type<PayoutAccountStatus>()
      .notNull()
      .default('active'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    // When a newer account replaced this one. Retired rows are kept: they are
    // the history of where an organizer's money was allowed to go.
    retiredAt: timestamp('retired_at'),
  },
  (t) => [
    // One active account per organizer, enforced by the database so two
    // concurrent saves cannot leave two.
    uniqueIndex('payout_accounts_one_active_idx')
      .on(t.organizerId)
      .where(sql`${t.status} = 'active'`),
    index('payout_accounts_organizer_idx').on(t.organizerId),
  ]
)

// ─── Withdrawal requests ────────────────────────────────────────────────────

export const payouts = pgTable(
  'payouts',
  {
    id: text('id').primaryKey(),
    // Soft pointer to user.id — see the note at the top.
    organizerId: text('organizer_id').notNull(),
    organizerName: text('organizer_name').notNull().default(''),
    organizerEmail: text('organizer_email').notNull().default(''),
    // Kobo. Whole naira only (CHECK below): Flutterwave transfers are sent in
    // naira and a fraction would be rounded somewhere nobody is looking.
    amountMinor: integer('amount_minor').notNull(),
    currency: text('currency').notNull().default('NGN'),
    status: text('status')
      .$type<PayoutStatus>()
      .notNull()
      .default('pending_review'),
    method: text('method').$type<PayoutMethod>(),

    // The bank account this payout goes to, COPIED from payout_accounts at
    // request time. An organizer (or someone who has taken over their login)
    // changing the account afterwards cannot redirect a payout already asked
    // for: what the admin approves is exactly what gets paid.
    accountId: text('account_id'),
    bankCode: text('bank_code').notNull(),
    bankName: text('bank_name').notNull(),
    accountNumber: text('account_number').notNull(),
    accountName: text('account_name').notNull(),
    // When that account was added, so the reviewer sees how new it is.
    accountAddedAt: timestamp('account_added_at'),

    requestedAt: timestamp('requested_at').notNull().defaultNow(),
    reviewedBy: text('reviewed_by').references(() => user.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    // Snapshot: `reviewedBy` goes NULL if that admin is ever deleted.
    reviewedByName: text('reviewed_by_name').notNull().default(''),
    reviewedAt: timestamp('reviewed_at'),
    rejectionReason: text('rejection_reason').notNull().default(''),
    // For a payout made by hand: what the admin recorded, e.g. the
    // Flutterwave dashboard reference.
    manualReference: text('manual_reference').notNull().default(''),
    paidAt: timestamp('paid_at'),
    // Why the last attempt failed, or why the transfer job is holding it
    // (e.g. the Flutterwave balance is short). Shown to the admin.
    failureReason: text('failure_reason').notNull().default(''),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    // At most one open request per organizer. This, not the application
    // code, is what stops two requests racing past the balance check.
    uniqueIndex('payouts_one_open_per_organizer_idx')
      .on(t.organizerId)
      .where(
        sql`${t.status} in ('pending_review', 'approved', 'processing')`
      ),
    index('payouts_organizer_idx').on(t.organizerId, t.requestedAt),
    index('payouts_status_idx').on(t.status, t.requestedAt),
    check('payouts_amount_positive', sql`${t.amountMinor} > 0`),
    check('payouts_amount_whole_naira', sql`${t.amountMinor} % 100 = 0`),
  ]
)

// ─── Transfer attempts ──────────────────────────────────────────────────────

export const payoutTransfers = pgTable(
  'payout_transfers',
  {
    id: text('id').primaryKey(),
    payoutId: text('payout_id')
      .notNull()
      .references(() => payouts.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    // 1, 2, 3 … A new attempt is only ever made after the previous one is
    // definitively 'failed'.
    attempt: integer('attempt').notNull(),
    // OUR reference, sent to Flutterwave. Unique, and derived from the payout
    // id and the attempt (packages/db/src/payouts/references.ts), so a lookup
    // can always find what an ambiguous call did.
    reference: text('reference').notNull().unique(),
    flwTransferId: text('flw_transfer_id'),
    status: text('status')
      .$type<PayoutTransferStatus>()
      .notNull()
      .default('unconfirmed'),
    amountMinor: integer('amount_minor').notNull(),
    // Flutterwave's charge for the transfer, once it tells us. The platform
    // pays it; it is not taken from the organizer.
    feeMinor: integer('fee_minor'),
    completeMessage: text('complete_message').notNull().default(''),
    lastError: text('last_error').notNull().default(''),
    // The last Flutterwave transfer record we read, for whoever investigates.
    raw: jsonb('raw').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    lastCheckedAt: timestamp('last_checked_at'),
    completedAt: timestamp('completed_at'),
  },
  (t) => [
    uniqueIndex('payout_transfers_attempt_idx').on(t.payoutId, t.attempt),
    index('payout_transfers_status_idx').on(t.status),
  ]
)

// ─── Adjustments ────────────────────────────────────────────────────────────

// Append-only. An admin's correction to an organizer's balance, with a reason.
// Nothing edits or deletes these; a mistake is corrected with another row.
export const payoutAdjustments = pgTable(
  'payout_adjustments',
  {
    id: text('id').primaryKey(),
    // Soft pointer to user.id.
    organizerId: text('organizer_id').notNull(),
    // Kobo, signed. Negative takes money off the balance.
    amountMinor: integer('amount_minor').notNull(),
    kind: text('kind').$type<PayoutAdjustmentKind>().notNull(),
    reason: text('reason').notNull(),
    createdBy: text('created_by').references(() => user.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    createdByName: text('created_by_name').notNull().default(''),
    createdByEmail: text('created_by_email').notNull().default(''),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('payout_adjustments_organizer_idx').on(t.organizerId, t.createdAt),
    check('payout_adjustments_nonzero', sql`${t.amountMinor} <> 0`),
    // Money paid outside the system can only ever reduce what is owed.
    check(
      'payout_adjustments_paid_outside_negative',
      sql`${t.kind} <> 'paid_outside' or ${t.amountMinor} < 0`
    ),
  ]
)

// ─── Per-organizer settings ─────────────────────────────────────────────────

// No row means the defaults. Only admins write here.
export const payoutSettings = pgTable('payout_settings', {
  organizerId: text('organizer_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  // UNUSED since 2026-11-28: earnings are withdrawable as soon as they are
  // paid for every organizer, so there is nothing left to release early.
  // Kept (no migration) in case a hold ever comes back.
  earlyRelease: boolean('early_release').notNull().default(false),
  updatedBy: text('updated_by').references(() => user.id, {
    onDelete: 'set null',
    onUpdate: 'cascade',
  }),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ─── History ────────────────────────────────────────────────────────────────

// Append-only: one row per status change of a payout, with who made it. The
// payout row says where things stand; this says how they got there.
export const payoutEvents = pgTable(
  'payout_events',
  {
    id: text('id').primaryKey(),
    payoutId: text('payout_id')
      .notNull()
      .references(() => payouts.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    // NULL for the request itself.
    fromStatus: text('from_status').$type<PayoutStatus>(),
    toStatus: text('to_status').$type<PayoutStatus>().notNull(),
    actorType: text('actor_type').$type<PayoutActorType>().notNull(),
    // Soft pointer to user.id; NULL for the system.
    actorId: text('actor_id'),
    actorName: text('actor_name').notNull().default(''),
    note: text('note').notNull().default(''),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('payout_events_payout_idx').on(t.payoutId, t.createdAt)]
)

// ─── One-time codes ─────────────────────────────────────────────────────────

// The emailed code an organizer types to add a bank account or to request a
// withdrawal. Only a scrypt digest is stored, and the digest binds the user,
// the PURPOSE and the exact action (the account, or the amount and account):
// a code sent for one thing cannot be spent on another. That purpose column
// is the gap `vote_otps` has.
export const payoutCodes = pgTable(
  'payout_codes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    purpose: text('purpose').$type<PayoutCodePurpose>().notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    attempts: integer('attempts').notNull().default(0),
    consumedAt: timestamp('consumed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('payout_codes_lookup_idx').on(t.userId, t.purpose, t.createdAt),
  ]
)

// ─── Relations ──────────────────────────────────────────────────────────────

export const payoutAccountsRelations = relations(payoutAccounts, ({ one }) => ({
  organizer: one(user, {
    fields: [payoutAccounts.organizerId],
    references: [user.id],
  }),
}))

export const payoutsRelations = relations(payouts, ({ many }) => ({
  transfers: many(payoutTransfers),
  events: many(payoutEvents),
}))

export const payoutTransfersRelations = relations(
  payoutTransfers,
  ({ one }) => ({
    payout: one(payouts, {
      fields: [payoutTransfers.payoutId],
      references: [payouts.id],
    }),
  })
)

export const payoutEventsRelations = relations(payoutEvents, ({ one }) => ({
  payout: one(payouts, {
    fields: [payoutEvents.payoutId],
    references: [payouts.id],
  }),
}))

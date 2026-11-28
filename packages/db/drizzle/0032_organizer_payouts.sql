CREATE TABLE "payout_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"organizer_id" text NOT NULL,
	"bank_code" text NOT NULL,
	"bank_name" text NOT NULL,
	"account_number" text NOT NULL,
	"account_name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"retired_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "payout_adjustments" (
	"id" text PRIMARY KEY NOT NULL,
	"organizer_id" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"kind" text NOT NULL,
	"reason" text NOT NULL,
	"created_by" text,
	"created_by_name" text DEFAULT '' NOT NULL,
	"created_by_email" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payout_adjustments_nonzero" CHECK ("payout_adjustments"."amount_minor" <> 0),
	CONSTRAINT "payout_adjustments_paid_outside_negative" CHECK ("payout_adjustments"."kind" <> 'paid_outside' or "payout_adjustments"."amount_minor" < 0)
);
--> statement-breakpoint
CREATE TABLE "payout_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"purpose" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_events" (
	"id" text PRIMARY KEY NOT NULL,
	"payout_id" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"actor_name" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_settings" (
	"organizer_id" text PRIMARY KEY NOT NULL,
	"early_release" boolean DEFAULT false NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"payout_id" text NOT NULL,
	"attempt" integer NOT NULL,
	"reference" text NOT NULL,
	"flw_transfer_id" text,
	"status" text DEFAULT 'unconfirmed' NOT NULL,
	"amount_minor" integer NOT NULL,
	"fee_minor" integer,
	"complete_message" text DEFAULT '' NOT NULL,
	"last_error" text DEFAULT '' NOT NULL,
	"raw" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_checked_at" timestamp,
	"completed_at" timestamp,
	CONSTRAINT "payout_transfers_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" text PRIMARY KEY NOT NULL,
	"organizer_id" text NOT NULL,
	"organizer_name" text DEFAULT '' NOT NULL,
	"organizer_email" text DEFAULT '' NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"method" text,
	"account_id" text,
	"bank_code" text NOT NULL,
	"bank_name" text NOT NULL,
	"account_number" text NOT NULL,
	"account_name" text NOT NULL,
	"account_added_at" timestamp,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_by" text,
	"reviewed_by_name" text DEFAULT '' NOT NULL,
	"reviewed_at" timestamp,
	"rejection_reason" text DEFAULT '' NOT NULL,
	"manual_reference" text DEFAULT '' NOT NULL,
	"paid_at" timestamp,
	"failure_reason" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payouts_amount_positive" CHECK ("payouts"."amount_minor" > 0),
	CONSTRAINT "payouts_amount_whole_naira" CHECK ("payouts"."amount_minor" % 100 = 0)
);
--> statement-breakpoint
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_organizer_id_user_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payout_adjustments" ADD CONSTRAINT "payout_adjustments_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payout_codes" ADD CONSTRAINT "payout_codes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payout_events" ADD CONSTRAINT "payout_events_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payout_settings" ADD CONSTRAINT "payout_settings_organizer_id_user_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payout_settings" ADD CONSTRAINT "payout_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payout_transfers" ADD CONSTRAINT "payout_transfers_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "payout_accounts_one_active_idx" ON "payout_accounts" USING btree ("organizer_id") WHERE "payout_accounts"."status" = 'active';--> statement-breakpoint
CREATE INDEX "payout_accounts_organizer_idx" ON "payout_accounts" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "payout_adjustments_organizer_idx" ON "payout_adjustments" USING btree ("organizer_id","created_at");--> statement-breakpoint
CREATE INDEX "payout_codes_lookup_idx" ON "payout_codes" USING btree ("user_id","purpose","created_at");--> statement-breakpoint
CREATE INDEX "payout_events_payout_idx" ON "payout_events" USING btree ("payout_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payout_transfers_attempt_idx" ON "payout_transfers" USING btree ("payout_id","attempt");--> statement-breakpoint
CREATE INDEX "payout_transfers_status_idx" ON "payout_transfers" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_one_open_per_organizer_idx" ON "payouts" USING btree ("organizer_id") WHERE "payouts"."status" in ('pending_review', 'approved', 'processing');--> statement-breakpoint
CREATE INDEX "payouts_organizer_idx" ON "payouts" USING btree ("organizer_id","requested_at");--> statement-breakpoint
CREATE INDEX "payouts_status_idx" ON "payouts" USING btree ("status","requested_at");
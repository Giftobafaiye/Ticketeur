ALTER TABLE "orders" ADD COLUMN "voucher_counted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Paid orders were counted against their voucher when they were fulfilled;
-- record that, so nothing counts them again. Unpaid ones were not counted and
-- stay false: if one is paid later, fulfilment counts it then.
UPDATE "orders" SET "voucher_counted" = true WHERE "status" = 'paid' AND "voucher_id" IS NOT NULL;

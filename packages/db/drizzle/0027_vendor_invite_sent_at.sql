ALTER TABLE "external_vendor_invites" ADD COLUMN "sent_at" timestamp;--> statement-breakpoint
-- Invites created before this column existed were emailed (and linked) at
-- creation time; mark them sent so approving their event does not resend.
UPDATE "external_vendor_invites" SET "sent_at" = "created_at";

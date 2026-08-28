CREATE TABLE "vendor_profile_views" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" text NOT NULL,
	"viewer_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendor_profile_views" ADD CONSTRAINT "vendor_profile_views_vendor_id_user_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vendor_profile_views" ADD CONSTRAINT "vendor_profile_views_viewer_id_user_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "vendor_profile_views_vendor_idx" ON "vendor_profile_views" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_profile_views_vendor_created_idx" ON "vendor_profile_views" USING btree ("vendor_id","created_at");
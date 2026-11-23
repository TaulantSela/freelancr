ALTER TABLE "users" ADD COLUMN "vat_registered" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "vat_number" text;
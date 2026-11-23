ALTER TABLE "clients" ADD COLUMN "invoice_language" text;--> statement-breakpoint
-- Existing clients: Macedonian for clients in North Macedonia, English for the rest.
UPDATE "clients" SET "invoice_language" = CASE WHEN "country" = 'MK' THEN 'mk' ELSE 'en' END WHERE "invoice_language" IS NULL;
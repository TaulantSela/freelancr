ALTER TABLE "invoices" ADD COLUMN "supply_date" text;--> statement-breakpoint
-- Existing invoices: the date of supply is taken to be the invoice date.
UPDATE "invoices" SET "supply_date" = "date" WHERE "supply_date" IS NULL;
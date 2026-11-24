ALTER TABLE "users" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- The demo account's password is public in the README.
UPDATE "users" SET "is_demo" = true WHERE "email" = 'demo@freelancr.mk';

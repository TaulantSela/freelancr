-- Account emails are case-insensitive (lib/auth/email.ts): store them in
-- lower case, then allow one account per address whatever the case.
UPDATE "users" SET "email" = lower(trim("email")) WHERE "email" <> lower(trim("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower("email"));

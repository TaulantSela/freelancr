CREATE TABLE "credit_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"number" text NOT NULL,
	"date" text NOT NULL,
	"amount" double precision NOT NULL,
	"ddv_amount" double precision DEFAULT 0 NOT NULL,
	"reason" text NOT NULL,
	"rate_to_mkd" double precision NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "credit_notes_amount_positive" CHECK ("credit_notes"."amount" > 0),
	CONSTRAINT "credit_notes_ddv_amount_not_negative" CHECK ("credit_notes"."ddv_amount" >= 0),
	CONSTRAINT "credit_notes_rate_positive" CHECK ("credit_notes"."rate_to_mkd" > 0)
);
--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_notes_user_id_number_unique" ON "credit_notes" USING btree ("user_id","number");--> statement-breakpoint
CREATE INDEX "credit_notes_invoice_id_idx" ON "credit_notes" USING btree ("invoice_id");
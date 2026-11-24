CREATE TABLE "invoice_emails" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"to_address" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"provider_id" text,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "invoice_emails" ADD CONSTRAINT "invoice_emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_emails" ADD CONSTRAINT "invoice_emails_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_emails_user_id_sent_at_idx" ON "invoice_emails" USING btree ("user_id","sent_at");--> statement-breakpoint
CREATE INDEX "invoice_emails_invoice_id_idx" ON "invoice_emails" USING btree ("invoice_id");
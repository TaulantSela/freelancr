CREATE TABLE "attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"payment_id" text,
	"client_id" text,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "attachments_one_owner" CHECK (num_nonnulls("attachments"."payment_id", "attachments"."client_id") = 1),
	CONSTRAINT "attachments_size" CHECK ("attachments"."size_bytes" > 0 and "attachments"."size_bytes" <= 4194304),
	CONSTRAINT "attachments_content_type" CHECK ("attachments"."content_type" in ('application/pdf', 'image/png', 'image/jpeg'))
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_user_id_idx" ON "attachments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "attachments_payment_id_idx" ON "attachments" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "attachments_client_id_idx" ON "attachments" USING btree ("client_id");
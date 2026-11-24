CREATE TABLE "email_log" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_log_sent_at_idx" ON "email_log" USING btree ("sent_at");
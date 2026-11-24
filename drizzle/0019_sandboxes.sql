CREATE TABLE "sandbox_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"ip_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "demo_expires_at" timestamp;--> statement-breakpoint
CREATE INDEX "sandbox_requests_ip_hash_created_at_idx" ON "sandbox_requests" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "users_demo_expires_at_idx" ON "users" USING btree ("demo_expires_at");
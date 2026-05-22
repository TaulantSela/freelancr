CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"tax_id" text,
	"country" text DEFAULT 'MK' NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"address" text,
	"contact_person" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exchange_rate_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"from_currency" text NOT NULL,
	"to_currency" text NOT NULL,
	"rate" double precision NOT NULL,
	"source" text DEFAULT 'nbrm'
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"description" text NOT NULL,
	"quantity" double precision DEFAULT 1 NOT NULL,
	"unit_price" double precision NOT NULL,
	"total" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"client_id" text NOT NULL,
	"number" text NOT NULL,
	"date" text NOT NULL,
	"due_date" text,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"exchange_rate_mkd" double precision DEFAULT 1 NOT NULL,
	"subtotal" double precision DEFAULT 0 NOT NULL,
	"ddv_rate" double precision DEFAULT 0 NOT NULL,
	"ddv_amount" double precision DEFAULT 0 NOT NULL,
	"total" double precision DEFAULT 0 NOT NULL,
	"total_mkd" double precision DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"paid_at" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"business_name" text,
	"business_type" text DEFAULT 'personal',
	"tax_number" text,
	"address" text,
	"bank_account" text,
	"bank_name" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"client_id" text NOT NULL,
	"invoice_id" text,
	"received_on" text NOT NULL,
	"currency" text NOT NULL,
	"amount" double precision NOT NULL,
	"fees" double precision DEFAULT 0 NOT NULL,
	"tax_withheld" double precision DEFAULT 0 NOT NULL,
	"rate_to_mkd" double precision NOT NULL,
	"rate_source" text NOT NULL,
	"tax_treatment" text NOT NULL,
	"deemed_costs_rate" double precision DEFAULT 0 NOT NULL,
	"channel" text,
	"note" text,
	"ujp_status" text,
	"ujp_reference" text,
	"ujp_folio" text,
	"tax_paid_on" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount" > 0),
	CONSTRAINT "payments_fees_not_negative" CHECK ("payments"."fees" >= 0),
	CONSTRAINT "payments_tax_withheld_not_negative" CHECK ("payments"."tax_withheld" >= 0),
	CONSTRAINT "payments_rate_positive" CHECK ("payments"."rate_to_mkd" > 0),
	CONSTRAINT "payments_deemed_costs_rate_allowed" CHECK ("payments"."deemed_costs_rate" in (0, 0.2, 0.3, 0.4, 0.5))
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "deemed_costs_rate" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_user_id_received_on_idx" ON "payments" USING btree ("user_id","received_on");--> statement-breakpoint
CREATE INDEX "payments_invoice_id_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_deemed_costs_rate_allowed" CHECK ("clients"."deemed_costs_rate" in (0, 0.2, 0.3, 0.4, 0.5));--> statement-breakpoint
-- Backfill: one payment for every invoice marked paid before payments existed.
-- received_on is the day it was marked paid, in Skopje (paid_at holds an ISO
-- timestamp, or a plain date on older rows), else the invoice date. A company
-- in North Macedonia withholds 10% when it pays (Personal Income Tax law Art.
-- 80(1)), so for those the amount credited is 90% of the total and the other
-- 10% is tax withheld. The rate is the invoice's own ('invoice'). The ids are
-- deterministic, and the statement skips any that already exist.
INSERT INTO "payments" ("id", "user_id", "client_id", "invoice_id", "received_on", "currency", "amount", "fees", "tax_withheld", "rate_to_mkd", "rate_source", "tax_treatment", "deemed_costs_rate", "ujp_status")
SELECT
	'backfill-' || i."id",
	i."user_id",
	i."client_id",
	i."id",
	CASE
		WHEN i."paid_at" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN i."paid_at"
		WHEN i."paid_at" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$'
			THEN to_char(i."paid_at"::timestamptz AT TIME ZONE 'Europe/Skopje', 'YYYY-MM-DD')
		ELSE i."date"
	END,
	i."currency",
	CASE WHEN t."treatment" = 'withheld' THEN round((i."total" * 0.9)::numeric, 2)::double precision ELSE i."total" END,
	0,
	CASE WHEN t."treatment" = 'withheld' THEN round(i."total"::numeric - round((i."total" * 0.9)::numeric, 2), 2)::double precision ELSE 0 END,
	i."exchange_rate_mkd",
	'invoice',
	t."treatment",
	0,
	CASE WHEN t."treatment" = 'self_reported' THEN 'to_file' END
FROM "invoices" i
JOIN "clients" c ON c."id" = i."client_id"
JOIN "users" u ON u."id" = i."user_id"
CROSS JOIN LATERAL (
	SELECT CASE
		WHEN u."tax_status" = 'self_employed' THEN 'business'
		WHEN c."country" = 'MK' AND c."client_type" = 'company' THEN 'withheld'
		ELSE 'self_reported'
	END AS "treatment"
) t
WHERE i."status" = 'paid' AND i."total" > 0 AND i."exchange_rate_mkd" > 0
ON CONFLICT ("id") DO NOTHING;

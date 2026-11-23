import {
  pgTable,
  text,
  doublePrecision,
  integer,
  timestamp,
  boolean,
  uniqueIndex,
  index,
  check,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { DEFAULT_TAX_STATUS, TAX_STATUSES } from "../tax/calculator";
import {
  PAYMENT_CHANNELS,
  PAYMENT_RATE_SOURCES,
  TAX_TREATMENTS,
  UJP_STATUSES,
} from "../payments/config";
import {
  CLIENT_TYPES,
  DEFAULT_CLIENT_TYPE,
  INVOICE_LANGUAGES,
} from "../clients/config";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  businessName: text("business_name"),
  // No longer asked for or read: the tax status below replaced it. Kept
  // because migrations here only ever add columns.
  businessType: text("business_type").default("personal"),
  taxNumber: text("tax_number"),
  address: text("address"),
  // The local account number (трансакциска сметка) clients in North
  // Macedonia pay into. Before iban existed this field was labelled "IBAN",
  // so an IBAN-looking value here is read as the IBAN (lib/profile.ts).
  bankAccount: text("bank_account"),
  bankName: text("bank_name"),
  iban: text("iban"),
  // BIC / SWIFT code of the bank.
  bic: text("bic"),
  // Place of issue printed on invoices (VAT law Art. 53(10) point 1).
  placeOfIssue: text("place_of_issue"),
  // The person authorised to sign invoices (Art. 53(10) point 10); invoices
  // fall back to the user's name. The personal ID number (ЕМБГ) is never
  // asked for or printed.
  signatoryName: text("signatory_name"),
  // How the user is registered for tax, which decides their UJP deadlines
  // (see lib/tax/calculator.ts). Existing rows get the default.
  taxStatus: text("tax_status", { enum: TAX_STATUSES })
    .notNull()
    .default(DEFAULT_TAX_STATUS),
  // Registered self-employed only: the monthly income tax advance in MKD,
  // 1/12 of the tax in last year's annual balance, as the user enters it.
  // Null when not entered.
  monthlyAdvanceMKD: doublePrecision("monthly_advance_mkd"),
  // Whether UJP has registered the user for VAT (DDV). Only then may an
  // invoice show VAT (VAT law Art. 51(3)); anyone who shows it without being
  // registered owes the amount shown (Art. 55). Existing rows: not
  // registered.
  vatRegistered: boolean("vat_registered").notNull().default(false),
  // The VAT number (ДДВ број, e.g. "MK4030000000000"), printed on invoices
  // when registered.
  vatNumber: text("vat_number"),
  // A shared account whose password is public (the demo, and Phase 5's
  // per-visitor sandboxes): it can't change its password, reset it, send
  // email or get reminders.
  isDemo: boolean("is_demo").notNull().default(false),
  // Carried in the session token as `sv`; a password change or reset bumps
  // it, which ends every session issued before (lib/auth/session.ts).
  sessionVersion: integer("session_version").notNull().default(0),
  // The language emails to the user are written in: the UI language at
  // sign-up, then whatever they switch to while signed in.
  locale: text("locale").notNull().default("mk"),
  // Emails before UJP deadlines (app/api/cron/daily); on unless turned off
  // in Settings.
  remindersEnabled: boolean("reminders_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
});

export const clients = pgTable("clients", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // "company" or "person" (lib/clients/config.ts). Existing rows get the
  // default.
  clientType: text("client_type", { enum: CLIENT_TYPES })
    .notNull()
    .default(DEFAULT_CLIENT_TYPE),
  email: text("email"),
  taxId: text("tax_id"),
  country: text("country").notNull().default("MK"),
  currency: text("currency").notNull().default("EUR"),
  // "mk", "sq" or "en": the language of this client's invoice PDFs. Nullable
  // so rows written by older code still insert; read it through
  // resolveInvoiceLanguage() (lib/clients/config.ts).
  invoiceLanguage: text("invoice_language", { enum: INVOICE_LANGUAGES }),
  address: text("address"),
  contactPerson: text("contact_person"),
  notes: text("notes"),
  // Deemed costs for author's-rights income (Personal Income Tax law Art.
  // 40): 0, 0.2, 0.3, 0.4 or 0.5. The default for this client's
  // self-reported payments; 0 for anything that isn't author's rights.
  deemedCostsRate: doublePrecision("deemed_costs_rate").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => [
  check(
    "clients_deemed_costs_rate_allowed",
    sql`${table.deemedCostsRate} in (0, 0.2, 0.3, 0.4, 0.5)`
  ),
]);

export const invoices = pgTable("invoices", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id),
  // INV-YYYY-NNN, given when the invoice is issued (lib/invoices/numbering.ts);
  // null while it's a draft. Invoices from before drafts went unnumbered keep
  // the number they were created with.
  number: text("number"),
  // Date of issue, "YYYY-MM-DD".
  date: text("date").notNull(),
  // Date of supply ("ден на извршениот промет", VAT law Art. 53(10) point 4),
  // "YYYY-MM-DD". Null only for rows written by older code; read it as
  // coalesce(supply_date, date).
  supplyDate: text("supply_date"),
  dueDate: text("due_date"),
  currency: text("currency").notNull().default("EUR"),
  // MKD for one unit of the currency: the NBRSM middle rate on the date of
  // supply, when the VAT liability arises (VAT law Art. 20, Art. 31(1)), or
  // today's for a supply date still ahead.
  exchangeRateMKD: doublePrecision("exchange_rate_mkd").notNull().default(1),
  // "nbrsm", or "approximate" when the National Bank couldn't be reached and
  // the fixed fallback rate was used. Null on invoices saved before rates
  // were looked up, which all used the fixed rates.
  rateSource: text("rate_source", { enum: ["nbrsm", "approximate"] }),
  // "YYYY-MM-DD": the day of the NBRSM list the rate comes from.
  rateDate: text("rate_date"),
  subtotal: doublePrecision("subtotal").notNull().default(0),
  ddvRate: doublePrecision("ddv_rate").notNull().default(0),
  ddvAmount: doublePrecision("ddv_amount").notNull().default(0),
  total: doublePrecision("total").notNull().default(0),
  totalMKD: doublePrecision("total_mkd").notNull().default(0),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  paidAt: text("paid_at"),
}, (table) => [
  // No two of a user's invoices share a number; drafts have none.
  uniqueIndex("invoices_user_id_number_unique")
    .on(table.userId, table.number)
    .where(sql`${table.number} is not null`),
]);

export const invoiceItems = pgTable("invoice_items", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: doublePrecision("quantity").notNull().default(1),
  unitPrice: doublePrecision("unit_price").notNull(),
  total: doublePrecision("total").notNull(),
});

// Money a client sent, as it reached the account (lib/payments/config.ts).
// An invoice is settled by the payments linked to it; a payment without an
// invoice is a payout (a platform, a one-off job). Amounts are in the
// payment's currency, which is the invoice's when linked.
export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Who paid. Platforms such as Upwork are clients too.
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id),
  // Null for a payout without an invoice.
  invoiceId: text("invoice_id").references(() => invoices.id),
  // "YYYY-MM-DD": the day the money reached the account, when the income is
  // realised (Personal Income Tax law Art. 93(2)).
  receivedOn: text("received_on").notNull(),
  currency: text("currency").notNull(),
  // What was credited.
  amount: doublePrecision("amount").notNull(),
  // Taken by banks or platforms on the way: it settles the invoice but isn't
  // income.
  fees: doublePrecision("fees").notNull().default(0),
  // Tax the payer withheld at source, in the payment's currency: a local
  // company's 10% (Art. 80(1)) or tax withheld abroad (Art. 8(4)).
  taxWithheld: doublePrecision("tax_withheld").notNull().default(0),
  // MKD for one unit of the currency on received_on.
  rateToMKD: doublePrecision("rate_to_mkd").notNull(),
  rateSource: text("rate_source", { enum: PAYMENT_RATE_SOURCES }).notNull(),
  // Fixed when saved; not editable, and kept if the user's tax status
  // changes later.
  taxTreatment: text("tax_treatment", { enum: TAX_TREATMENTS }).notNull(),
  deemedCostsRate: doublePrecision("deemed_costs_rate").notNull().default(0),
  channel: text("channel", { enum: PAYMENT_CHANNELS }),
  note: text("note"),
  // Self-reported payments only: where the е-ПДД calculation stands, its
  // number, UJP's folio number and the day the tax was paid.
  ujpStatus: text("ujp_status", { enum: UJP_STATUSES }),
  ujpReference: text("ujp_reference"),
  ujpFolio: text("ujp_folio"),
  taxPaidOn: text("tax_paid_on"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => [
  index("payments_user_id_received_on_idx").on(table.userId, table.receivedOn),
  index("payments_invoice_id_idx").on(table.invoiceId),
  check("payments_amount_positive", sql`${table.amount} > 0`),
  check("payments_fees_not_negative", sql`${table.fees} >= 0`),
  check("payments_tax_withheld_not_negative", sql`${table.taxWithheld} >= 0`),
  check("payments_rate_positive", sql`${table.rateToMKD} > 0`),
  check(
    "payments_deemed_costs_rate_allowed",
    sql`${table.deemedCostsRate} in (0, 0.2, 0.3, 0.4, 0.5)`
  ),
]);

// Deadline reminders that went out: one row per user, kind and period
// (e.g. "file-by-10", "2026-10"). The row is written before the email, so
// a second run of the cron sends nothing; a failed send deletes it again.
export const reminderLog = pgTable("reminder_log", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  period: text("period").notNull(),
  sentAt: timestamp("sent_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("reminder_log_user_id_kind_period_unique").on(table.userId, table.kind, table.period),
]);

// Every attempt to email an invoice to a client: a row is written before
// the send (so at most 20 a user a day, counted in the same statement) and
// completed with Resend's id, or the error.
export const invoiceEmails = pgTable("invoice_emails", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id),
  toAddress: text("to_address").notNull(),
  sentAt: timestamp("sent_at", { mode: "string" }).notNull().defaultNow(),
  providerId: text("provider_id"),
  error: text("error"),
}, (table) => [
  index("invoice_emails_user_id_sent_at_idx").on(table.userId, table.sentAt),
  index("invoice_emails_invoice_id_idx").on(table.invoiceId),
]);

// Password reset links: a token goes out by email, only its sha256 is kept.
// It lasts 60 minutes and works once; a successful reset marks all of the
// user's tokens used (lib/auth/reset.ts). At most 3 a user an hour.
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // sha256 of the token, hex.
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
  usedAt: timestamp("used_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("password_reset_tokens_token_hash_unique").on(table.tokenHash),
  index("password_reset_tokens_user_id_created_at_idx").on(table.userId, table.createdAt),
]);

// Every "forgot password" request, by a keyed hash of the requester's IP
// (not the IP itself), to allow at most 10 an hour from one IP.
export const passwordResetRequests = pgTable("password_reset_requests", {
  id: text("id").primaryKey(),
  ipHash: text("ip_hash").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
  index("password_reset_requests_ip_hash_created_at_idx").on(table.ipHash, table.createdAt),
]);

// A credit note (книжно одобрение) on an issued invoice: it lowers what the
// client owes, and the base and DDV with it, in the period of its date (VAT
// law Art. 22(1): the supplier corrects the tax "во текот на даночниот
// период на извршената промена"). Numbered CN-YYYY-NNN per user by the
// credit note's year when it's created (lib/credit-notes/write.ts); there
// are no drafts, and only the user's latest can be deleted, so numbers run
// without gaps.
export const creditNotes = pgTable("credit_notes", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id),
  number: text("number").notNull(),
  // "YYYY-MM-DD"
  date: text("date").notNull(),
  // In the invoice's currency, DDV included.
  amount: doublePrecision("amount").notNull(),
  // The DDV part of `amount`, in the invoice's proportion; 0 without DDV.
  ddvAmount: doublePrecision("ddv_amount").notNull().default(0),
  reason: text("reason").notNull(),
  // The invoice's rate, so the MKD figures net off against it.
  rateToMKD: doublePrecision("rate_to_mkd").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => [
  uniqueIndex("credit_notes_user_id_number_unique").on(table.userId, table.number),
  index("credit_notes_invoice_id_idx").on(table.invoiceId),
  check("credit_notes_amount_positive", sql`${table.amount} > 0`),
  check("credit_notes_ddv_amount_not_negative", sql`${table.ddvAmount} >= 0`),
  check("credit_notes_rate_positive", sql`${table.rateToMKD} > 0`),
]);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

// Files kept as proof: a payment's (the bank statement, the contract or
// confirmation е-ПДД needs) or a client's (contracts). Exactly one of the
// two is set, and the file goes when its payment or client does. The bytes
// are only ever selected by the download route (lib/attachments/queries.ts).
export const attachments = pgTable("attachments", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  paymentId: text("payment_id").references(() => payments.id, { onDelete: "cascade" }),
  clientId: text("client_id").references(() => clients.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  // From the file's first bytes, never from what the browser sent.
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => [
  index("attachments_user_id_idx").on(table.userId),
  index("attachments_payment_id_idx").on(table.paymentId),
  index("attachments_client_id_idx").on(table.clientId),
  check("attachments_one_owner", sql`num_nonnulls(${table.paymentId}, ${table.clientId}) = 1`),
  check("attachments_size", sql`${table.sizeBytes} > 0 and ${table.sizeBytes} <= 4194304`),
  check(
    "attachments_content_type",
    sql`${table.contentType} in ('application/pdf', 'image/png', 'image/jpeg')`
  ),
]);

// The National Bank's middle rates, cached per day and currency
// (lib/rates/queries.ts).
export const exchangeRateCache = pgTable("exchange_rate_cache", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  fromCurrency: text("from_currency").notNull(),
  toCurrency: text("to_currency").notNull(),
  rate: doublePrecision("rate").notNull(),
  source: text("source").default("nbrm"),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type NewInvoiceItem = typeof invoiceItems.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type CreditNote = typeof creditNotes.$inferSelect;
export type NewCreditNote = typeof creditNotes.$inferInsert;

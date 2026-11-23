import {
  pgTable,
  text,
  doublePrecision,
  timestamp,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { DEFAULT_TAX_STATUS, TAX_STATUSES } from "../tax/calculator";
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
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
});

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

// Not read or written yet: invoices use the fixed rates in
// lib/tax/calculator.ts. Kept for caching the National Bank's daily rates.
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

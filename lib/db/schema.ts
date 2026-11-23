import {
  pgTable,
  text,
  doublePrecision,
  timestamp,
} from "drizzle-orm/pg-core";
import { DEFAULT_TAX_STATUS, TAX_STATUSES } from "../tax/calculator";

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
  bankAccount: text("bank_account"),
  bankName: text("bank_name"),
  // How the user is registered for tax, which decides their UJP deadlines
  // (see lib/tax/calculator.ts). Existing rows get the default.
  taxStatus: text("tax_status", { enum: TAX_STATUSES })
    .notNull()
    .default(DEFAULT_TAX_STATUS),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
});

export const clients = pgTable("clients", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  taxId: text("tax_id"),
  country: text("country").notNull().default("MK"),
  currency: text("currency").notNull().default("EUR"),
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
  number: text("number").notNull(),
  date: text("date").notNull(),
  dueDate: text("due_date"),
  currency: text("currency").notNull().default("EUR"),
  exchangeRateMKD: doublePrecision("exchange_rate_mkd").notNull().default(1),
  subtotal: doublePrecision("subtotal").notNull().default(0),
  ddvRate: doublePrecision("ddv_rate").notNull().default(0),
  ddvAmount: doublePrecision("ddv_amount").notNull().default(0),
  total: doublePrecision("total").notNull().default(0),
  totalMKD: doublePrecision("total_mkd").notNull().default(0),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  paidAt: text("paid_at"),
});

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

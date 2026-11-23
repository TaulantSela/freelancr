import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { getDb, invoices, clients, users, payments } from "@/lib/db";
import {
  DEFAULT_TAX_STATUS,
  isTaxStatus,
  type SelfReportedPayment,
  type TaxStatus,
  type ThresholdInvoice,
  type ThresholdPayout,
} from "./calculator";

export type TaxProfile = {
  taxStatus: TaxStatus;
  // Registered self-employed: the monthly advance they entered in Settings.
  monthlyAdvanceMKD: number | null;
  // Registered for VAT: the DDV threshold no longer applies to them.
  vatRegistered: boolean;
};

export async function getTaxProfile(userId: string): Promise<TaxProfile> {
  const [row] = await getDb()
    .select({
      taxStatus: users.taxStatus,
      monthlyAdvanceMKD: users.monthlyAdvanceMKD,
      vatRegistered: users.vatRegistered,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return {
    taxStatus: row && isTaxStatus(row.taxStatus) ? row.taxStatus : DEFAULT_TAX_STATUS,
    monthlyAdvanceMKD: row?.monthlyAdvanceMKD ?? null,
    vatRegistered: row?.vatRegistered ?? false,
  };
}

// Invoices whose date of supply (or, without one, invoice date) is in `year`,
// with the client's country; getLocalSupplies() picks the ones that count
// toward the DDV threshold.
export async function getInvoicesForThreshold(
  userId: string,
  year: number
): Promise<ThresholdInvoice[]> {
  const supplied = sql`coalesce(${invoices.supplyDate}, ${invoices.date})`;
  return getDb()
    .select({
      clientCountry: clients.country,
      status: invoices.status,
      supplyDate: invoices.supplyDate,
      date: invoices.date,
      totalMKD: invoices.totalMKD,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(
      and(
        eq(invoices.userId, userId),
        sql`${supplied} >= ${`${year}-01-01`}`,
        sql`${supplied} < ${`${year + 1}-01-01`}`
      )
    );
}

// Paid invoices that can lead to a deadline, or tax owed, in `year`: the ones
// paid from December of the year before, whose report is due in January. The
// bound is a day early because paidAt is stored in UTC, which is behind North
// Macedonia; getSelfReportedIncomeMonths() and getMonthlyTaxOwed() then work
// out each exact month.
export async function getPaidInvoicesForDeadlines(
  userId: string,
  year: number
): Promise<SelfReportedPayment[]> {
  const since = `${year - 1}-11-30`;
  const rows = await getDb()
    .select({
      paidAt: invoices.paidAt,
      date: invoices.date,
      clientCountry: clients.country,
      clientType: clients.clientType,
      subtotal: invoices.subtotal,
      exchangeRateMKD: invoices.exchangeRateMKD,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(
      and(
        eq(invoices.userId, userId),
        eq(invoices.status, "paid"),
        sql`coalesce(${invoices.paidAt}, ${invoices.date}) >= ${since}`
      )
    );
  return rows.map(({ subtotal, exchangeRateMKD, ...row }) => ({
    ...row,
    amountMKD: subtotal * exchangeRateMKD,
  }));
}

// Payments without an invoice received in `year`, with the payer's country;
// getLocalSupplies() counts the ones from clients in North Macedonia.
export async function getPayoutsForThreshold(
  userId: string,
  year: number
): Promise<ThresholdPayout[]> {
  const rows = await getDb()
    .select({
      clientCountry: clients.country,
      receivedOn: payments.receivedOn,
      valueMKD: sql<number>`(${payments.amount} + ${payments.fees} + ${payments.taxWithheld}) * ${payments.rateToMKD}`,
    })
    .from(payments)
    .innerJoin(clients, eq(payments.clientId, clients.id))
    .where(
      and(
        eq(payments.userId, userId),
        isNull(payments.invoiceId),
        gte(payments.receivedOn, `${year}-01-01`),
        lte(payments.receivedOn, `${year}-12-31`)
      )
    );
  return rows.map((r) => ({ ...r, valueMKD: Number(r.valueMKD) }));
}

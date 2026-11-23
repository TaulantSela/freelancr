import { and, eq, sql } from "drizzle-orm";
import { getDb, invoices, clients, users } from "@/lib/db";
import {
  DEFAULT_TAX_STATUS,
  isTaxStatus,
  type SelfReportedPayment,
  type TaxStatus,
} from "./calculator";

export type TaxProfile = {
  taxStatus: TaxStatus;
  // Registered self-employed: the monthly advance they entered in Settings.
  monthlyAdvanceMKD: number | null;
};

export async function getTaxProfile(userId: string): Promise<TaxProfile> {
  const [row] = await getDb()
    .select({ taxStatus: users.taxStatus, monthlyAdvanceMKD: users.monthlyAdvanceMKD })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return {
    taxStatus: row && isTaxStatus(row.taxStatus) ? row.taxStatus : DEFAULT_TAX_STATUS,
    monthlyAdvanceMKD: row?.monthlyAdvanceMKD ?? null,
  };
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

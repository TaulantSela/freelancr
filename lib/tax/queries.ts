import { and, eq, sql } from "drizzle-orm";
import { getDb, invoices, clients, users } from "@/lib/db";
import { DEFAULT_TAX_STATUS, isTaxStatus, type TaxStatus } from "./calculator";

export async function getTaxStatus(userId: string): Promise<TaxStatus> {
  const [row] = await getDb()
    .select({ taxStatus: users.taxStatus })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row && isTaxStatus(row.taxStatus) ? row.taxStatus : DEFAULT_TAX_STATUS;
}

// Paid invoices that can lead to a deadline in `year`: the ones paid from
// December of the year before, whose report is due in January. The bound is
// a day early because paidAt is stored in UTC, which is behind North
// Macedonia; getSelfReportedIncomeMonths() then works out each exact month.
export async function getPaidInvoicesForDeadlines(userId: string, year: number) {
  const since = `${year - 1}-11-30`;
  return getDb()
    .select({
      paidAt: invoices.paidAt,
      date: invoices.date,
      clientCountry: clients.country,
      clientType: clients.clientType,
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
}

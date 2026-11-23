import { and, eq, gte, lte } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getDb, invoices, clients } from "@/lib/db";
import { getTranslations } from "@/lib/i18n/server";
import { getSettledByInvoice } from "@/lib/payments/queries";
import { getCreditedByInvoice } from "@/lib/credit-notes/queries";
import { invoiceStanding } from "@/lib/payments/settlement";
import { toSkopjeDate } from "@/lib/tax/calculator";
import { csvResponse, toCsv } from "@/lib/csv";
import { INVOICE_COLUMNS, exportYear } from "@/lib/exports/columns";

// The year's invoices (by invoice date), drafts and cancelled ones included,
// with what's credited, paid and left, as CSV.
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const year = exportYear(request.url);
  if (year === null) return new Response("Bad year", { status: 400 });

  const { t } = await getTranslations();
  const [rows, settledByInvoice, creditedByInvoice] = await Promise.all([
    getDb()
      .select({
        id: invoices.id,
        number: invoices.number,
        status: invoices.status,
        date: invoices.date,
        supplyDate: invoices.supplyDate,
        dueDate: invoices.dueDate,
        clientName: clients.name,
        clientCountry: clients.country,
        currency: invoices.currency,
        subtotal: invoices.subtotal,
        ddvRate: invoices.ddvRate,
        ddvAmount: invoices.ddvAmount,
        total: invoices.total,
        exchangeRateMKD: invoices.exchangeRateMKD,
        rateSource: invoices.rateSource,
        totalMKD: invoices.totalMKD,
      })
      .from(invoices)
      .innerJoin(clients, eq(invoices.clientId, clients.id))
      .where(
        and(
          eq(invoices.userId, session.userId),
          gte(invoices.date, `${year}-01-01`),
          lte(invoices.date, `${year}-12-31`)
        )
      )
      .orderBy(invoices.date, invoices.number),
    getSettledByInvoice(session.userId),
    getCreditedByInvoice(session.userId),
  ]);
  const today = toSkopjeDate(new Date());
  const body = rows.map((inv) => {
    const settled = settledByInvoice.get(inv.id) ?? 0;
    const credited = creditedByInvoice.get(inv.id) ?? 0;
    const standing = invoiceStanding(inv, settled, today, credited);
    return [
      inv.number ?? "",
      t.invoices.standing[standing.status],
      inv.date,
      inv.supplyDate ?? inv.date,
      inv.dueDate ?? "",
      inv.clientName,
      inv.clientCountry,
      inv.currency,
      inv.subtotal,
      inv.ddvRate,
      inv.ddvAmount,
      inv.total,
      credited,
      settled,
      standing.status === "draft" || standing.status === "cancelled" ? 0 : standing.balance,
      inv.exchangeRateMKD,
      inv.rateSource ? t.exports.invoiceRateSources[inv.rateSource] : t.exports.invoiceRateSources.approximate,
      inv.totalMKD,
    ];
  });
  const header = INVOICE_COLUMNS.map((c) => t.exports.invoices[c]);
  return csvResponse(toCsv(header, body), `invoices-${year}.csv`);
}

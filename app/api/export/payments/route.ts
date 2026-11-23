import { getSession } from "@/lib/auth/session";
import { getTranslations } from "@/lib/i18n/server";
import { getPaymentsReceived } from "@/lib/payments/queries";
import { paymentTax } from "@/lib/tax/payments";
import { csvResponse, toCsv } from "@/lib/csv";
import { PAYMENT_COLUMNS, exportYear } from "@/lib/exports/columns";

// The year's payments, with the tax on each (lib/tax/payments.ts), as CSV.
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const year = exportYear(request.url);
  if (year === null) return new Response("Bad year", { status: 400 });

  const { t } = await getTranslations();
  const rows = await getPaymentsReceived(session.userId, `${year}-01-01`, `${year}-12-31`);
  const p = t.payments;
  const body = [...rows].reverse().map((r) => {
    const tax = paymentTax(r);
    return [
      r.receivedOn,
      r.clientName,
      r.clientCountry,
      r.invoiceNumber ?? "",
      r.currency,
      r.amount,
      r.fees,
      r.taxWithheld,
      r.rateToMKD,
      p.rateSources[r.rateSource],
      tax.receivedMKD,
      tax.grossMKD,
      p.treatments[r.taxTreatment],
      r.deemedCostsRate,
      tax.baseMKD,
      tax.taxMKD,
      tax.creditMKD,
      tax.owedMKD,
      tax.alreadyPaidForYouMKD,
      r.ujpStatus ? p.ujpStatuses[r.ujpStatus] : "",
      r.ujpReference ?? "",
      r.ujpFolio ?? "",
      r.taxPaidOn ?? "",
      r.channel ? p.channels[r.channel] : "",
      r.note ?? "",
    ];
  });
  const header = PAYMENT_COLUMNS.map((c) => t.exports.payments[c]);
  return csvResponse(toCsv(header, body), `payments-${year}.csv`);
}

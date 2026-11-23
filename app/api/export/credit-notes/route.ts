import { getSession } from "@/lib/auth/session";
import { getTranslations } from "@/lib/i18n/server";
import { getCreditNotesForYear } from "@/lib/credit-notes/queries";
import { roundCents } from "@/lib/credit-notes/amounts";
import { csvResponse, toCsv } from "@/lib/csv";
import { CREDIT_NOTE_COLUMNS, exportYear } from "@/lib/exports/columns";

// The year's credit notes (by their date) as CSV, in MKD at the invoice's
// rate.
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const year = exportYear(request.url);
  if (year === null) return new Response("Bad year", { status: 400 });

  const { t } = await getTranslations();
  const rows = await getCreditNotesForYear(session.userId, year);
  const body = rows.map((c) => [
    c.number,
    c.date,
    c.invoiceNumber ?? "",
    c.clientName,
    c.currency,
    c.amount,
    c.ddvAmount,
    c.reason,
    roundCents(c.amount * c.rateToMKD),
  ]);
  const header = CREDIT_NOTE_COLUMNS.map((col) => t.exports.creditNotes[col]);
  return csvResponse(toCsv(header, body), `credit-notes-${year}.csv`);
}

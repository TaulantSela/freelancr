import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getCreditNoteDetail } from "@/lib/credit-notes/queries";
import { CreditNotePdfDocument } from "@/lib/pdf/credit-note-document";
import { getDictionary } from "@/lib/i18n/server";
import { resolveInvoiceLanguage } from "@/lib/clients/config";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const data = await getCreditNoteDetail(id, session.userId);
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // The client's invoice language, as on the invoice.
  const lang = resolveInvoiceLanguage(data.invoice.client);
  const dictionary = getDictionary(lang);

  const buffer = await renderToBuffer(
    <CreditNotePdfDocument
      data={data}
      labels={dictionary.creditNotes.pdf}
      invoiceLabels={dictionary.invoices.pdf}
      lang={lang}
    />
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${data.creditNote.number}.pdf"`,
    },
  });
}

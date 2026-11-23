import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getInvoiceDetail } from "@/lib/invoices/queries";
import { InvoicePdfDocument } from "@/lib/pdf/invoice-document";
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
  const data = await getInvoiceDetail(id, session.userId);

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // The client's invoice language, not the language the app is in.
  const lang = resolveInvoiceLanguage(data.client);
  const labels = getDictionary(lang).invoices.pdf;

  const buffer = await renderToBuffer(
    <InvoicePdfDocument data={data} labels={labels} lang={lang} />
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${data.invoice.number ?? "draft"}.pdf"`,
    },
  });
}

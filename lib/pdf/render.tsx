import { renderToBuffer } from "@react-pdf/renderer";
import type { InvoiceDetail } from "@/lib/invoices/queries";
import { InvoicePdfDocument } from "@/lib/pdf/invoice-document";
import { getDictionary } from "@/lib/i18n/server";
import { resolveInvoiceLanguage } from "@/lib/clients/config";

// An invoice's PDF in the client's invoice language, as the download route
// and the email to the client both send it.
export async function renderInvoicePdf(data: InvoiceDetail): Promise<Buffer> {
  const lang = resolveInvoiceLanguage(data.client);
  const labels = getDictionary(lang).invoices.pdf;
  return renderToBuffer(<InvoicePdfDocument data={data} labels={labels} lang={lang} />);
}

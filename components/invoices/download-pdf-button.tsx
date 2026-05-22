import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { getTranslations } from "@/lib/i18n/server";

export async function DownloadPdfButton({ invoiceId }: { invoiceId: string }) {
  const { t } = await getTranslations();

  return (
    <Link href={`/api/invoices/${invoiceId}/pdf`} target="_blank">
      <Button size="sm" variant="outline" className="gap-2">
        <Download className="h-4 w-4" />
        {t.invoices.downloadPdf}
      </Button>
    </Link>
  );
}

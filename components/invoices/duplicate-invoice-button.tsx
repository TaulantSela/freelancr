"use client";

import { useTransition } from "react";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { duplicateInvoice } from "@/lib/actions/invoices";
import { useTranslations } from "@/lib/i18n/client";

// Copies an invoice, in any state, into a new draft dated today, and opens
// it for editing.
export function DuplicateInvoiceButton({ id }: { id: string }) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-1.5"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await duplicateInvoice(id);
          if (result?.errorKey) toast.error(t.invoices.duplicate.failed);
        })
      }
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
      {t.invoices.duplicate.button}
    </Button>
  );
}

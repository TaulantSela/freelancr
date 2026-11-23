"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cancelInvoice } from "@/lib/actions/invoices";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n/client";
import { formatMessage } from "@/lib/i18n/format";

// An issued invoice is never deleted; it can be cancelled, and stays in the
// records.
export function CancelInvoiceButton({ id, number }: { id: string; number: string }) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelInvoice(id);
      if ("errorKey" in result) toast.error(t.invoices.cancel.notIssued);
      else toast.success(t.invoices.cancel.cancelled);
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            className="gap-1.5 text-destructive hover:text-destructive"
          >
            <Ban className="h-3.5 w-3.5" />
            {t.invoices.cancel.button}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{formatMessage(t.invoices.cancel.title, { number })}</AlertDialogTitle>
          <AlertDialogDescription>{t.invoices.cancel.desc}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.invoices.cancel.keep}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t.invoices.cancel.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

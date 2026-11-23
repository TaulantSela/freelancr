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
import { issueInvoice } from "@/lib/actions/invoices";
import { Stamp } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n/client";
import { formatMessage } from "@/lib/i18n/format";

// Issuing gives a draft its number (the next one for the invoice date's
// year) and locks it.
export function IssueInvoiceButton({ id, year }: { id: string; year: string }) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();

  function handleIssue() {
    startTransition(async () => {
      const result = await issueInvoice(id);
      if (result.errorKey) toast.error(t.invoices.issue[result.errorKey]);
      else if (result.number) {
        toast.success(formatMessage(t.invoices.issue.issued, { number: result.number }));
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button size="sm" className="gap-1.5" disabled={pending}>
            <Stamp className="h-3.5 w-3.5" />
            {t.invoices.issue.button}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.invoices.issue.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {formatMessage(t.invoices.issue.desc, { year })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={handleIssue} disabled={pending}>
            {t.invoices.issue.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

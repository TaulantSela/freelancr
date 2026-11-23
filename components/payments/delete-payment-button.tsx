"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { deletePayment } from "@/lib/actions/payments";
import { useTranslations } from "@/lib/i18n/client";
import { formatMessage } from "@/lib/i18n/format";

export function DeletePaymentButton({
  id,
  attachmentCount,
  filed,
}: {
  id: string;
  // Its files are deleted with it (ON DELETE CASCADE).
  attachmentCount: number;
  // Its month is already filed with UJP.
  filed: boolean;
}) {
  const t = useTranslations();
  const f = t.payments.form;
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
            {f.delete}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{f.deleteTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {f.deleteDesc}
            {attachmentCount > 0 && ` ${formatMessage(t.attachments.deleteWithPayment, { count: attachmentCount })}`}
          </AlertDialogDescription>
          {filed && <p className="text-sm text-amber-400">{f.filedWarning}</p>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() =>
              startTransition(async () => {
                const result = await deletePayment(id);
                if (result?.errorKey) toast.error(f.errors[result.errorKey]);
              })
            }
          >
            {f.delete}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

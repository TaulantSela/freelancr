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
import { deleteCreditNote } from "@/lib/actions/credit-notes";
import { useTranslations } from "@/lib/i18n/client";
import { formatMessage } from "@/lib/i18n/format";

// Only shown for the user's most recent credit note; the action checks that
// again.
export function DeleteCreditNoteButton({ id, number }: { id: string; number: string }) {
  const t = useTranslations();
  const c = t.creditNotes;
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive">
            <Trash2 className="h-3 w-3" /> {c.delete}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{formatMessage(c.deleteTitle, { number })}</AlertDialogTitle>
          <AlertDialogDescription>{c.deleteDesc}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() =>
              startTransition(async () => {
                const result = await deleteCreditNote(id);
                if ("errorKey" in result) toast.error(c.errors.notLatest);
              })
            }
          >
            {c.delete}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

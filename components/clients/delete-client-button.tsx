"use client";

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
import { deleteClient } from "@/lib/actions/clients";
import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n/client";
import { formatMessage } from "@/lib/i18n/format";

export function DeleteClientButton({
  id,
  name,
  invoiceCount,
}: {
  id: string;
  name: string;
  invoiceCount: number;
}) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const blocked = invoiceCount > 0;

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteClient(id);
      if (result?.errorKey === "deleteBlocked") {
        toast.error(
          formatMessage(t.clients.deleteBlockedDesc, {
            name,
            count: result.invoiceCount,
          })
        );
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        }
      />
      <AlertDialogContent>
        {blocked ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {formatMessage(t.clients.deleteBlockedTitle, { name })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {formatMessage(t.clients.deleteBlockedDesc, {
                  name,
                  count: invoiceCount,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.common.close}</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {formatMessage(t.clients.deleteTitle, { name })}
              </AlertDialogTitle>
              <AlertDialogDescription>{t.clients.deleteDesc}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={pending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t.common.delete}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

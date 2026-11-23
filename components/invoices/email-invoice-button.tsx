"use client";

import { useState, useTransition } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { emailInvoice } from "@/lib/actions/invoice-email";
import { useTranslations } from "@/lib/i18n/client";
import { formatMessage } from "@/lib/i18n/format";

// "Email to client": a form prefilled in the invoice's language. When email
// can't be sent (not set up on the server, or the demo account) the button
// is disabled and a line says why.
export function EmailInvoiceButton({
  invoiceId,
  number,
  accountEmail,
  defaults,
  disabledReason,
}: {
  invoiceId: string;
  number: string;
  accountEmail: string;
  defaults: { to: string; subject: string; message: string };
  disabledReason: string | null;
}) {
  const t = useTranslations();
  const e = t.invoices.email;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (disabledReason) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" disabled>
          <Mail className="h-3.5 w-3.5" /> {e.button}
        </Button>
        <span className="text-xs text-muted-foreground">{disabledReason}</span>
      </div>
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await emailInvoice(invoiceId, fd);
      if ("errorKey" in result) toast.error(e.errors[result.errorKey]);
      else {
        toast.success(formatMessage(e.sent, { to: result.to }));
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className="gap-1.5">
            <Mail className="h-3.5 w-3.5" /> {e.button}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{formatMessage(e.title, { number })}</DialogTitle>
          <DialogDescription>{formatMessage(e.attachmentNote, { email: accountEmail })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email-to">{e.to}</Label>
            <Input id="email-to" name="to" type="email" defaultValue={defaults.to} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-subject">{e.subject}</Label>
            <Input id="email-subject" name="subject" defaultValue={defaults.subject} required maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-message">{e.message}</Label>
            <Textarea id="email-message" name="message" rows={7} defaultValue={defaults.message} maxLength={5000} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="copy" className="accent-primary" defaultChecked />
            {e.copy}
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={pending} className="gap-2">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {e.send}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

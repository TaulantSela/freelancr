"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteAccount } from "@/lib/actions/account";
import { useTranslations } from "@/lib/i18n/client";

export function DeleteAccountForm() {
  const t = useTranslations();
  const d = t.settings.deleteAccount;
  const [state, action, pending] = useActionState(deleteAccount, null);
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-muted-foreground">{d.desc}</p>
      <p className="text-sm text-muted-foreground">
        {d.exportHint}{" "}
        <Link href="/privacy" className="text-primary hover:underline">
          {t.legal.privacy}
        </Link>
      </p>
      <div className="space-y-1.5 max-w-xs">
        <Label htmlFor="deletePassword">{d.password}</Label>
        <Input id="deletePassword" name="password" type="password" autoComplete="current-password" required />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirm" required className="mt-1 accent-destructive" />
        <span>{d.confirm}</span>
      </label>
      {state && "errorKey" in state && (
        <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{d.errors[state.errorKey]}</p>
      )}
      <Button type="submit" size="sm" variant="destructive" disabled={pending} className="gap-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {d.submit}
      </Button>
    </form>
  );
}

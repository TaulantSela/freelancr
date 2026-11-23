"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/actions/password-reset";
import { useTranslations } from "@/lib/i18n/client";

export function ForgotPasswordForm() {
  const t = useTranslations();
  const f = t.auth.forgot;
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  if (state && "sent" in state) {
    return (
      <div className="space-y-4">
        <p className="text-sm">{f.sent}</p>
        <Link href="/sign-in" className="text-sm underline underline-offset-2">
          {f.back}
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">{t.auth.email}</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      {state && "errorKey" in state && (
        <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{f.errors[state.errorKey]}</p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {f.submit}
      </Button>
      <p className="text-center text-sm">
        <Link href="/sign-in" className="text-muted-foreground underline underline-offset-2 hover:text-foreground">
          {f.back}
        </Link>
      </p>
    </form>
  );
}

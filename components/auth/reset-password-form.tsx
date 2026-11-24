"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/actions/password-reset";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { useTranslations } from "@/lib/i18n/client";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations();
  const r = t.auth.reset;
  const [state, action, pending] = useActionState(resetPassword, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">{r.new}</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          placeholder={t.auth.passwordHint}
          autoComplete="new-password"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">{r.confirm}</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
        />
      </div>
      {state?.errorKey && (
        <div className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2 space-y-1">
          <p>{r.errors[state.errorKey]}</p>
          {state.errorKey === "invalidToken" && (
            <Link href="/forgot-password" className="underline underline-offset-2">
              {r.requestNew}
            </Link>
          )}
        </div>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {r.submit}
      </Button>
    </form>
  );
}

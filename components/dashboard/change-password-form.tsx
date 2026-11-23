"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/lib/actions/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { useTranslations } from "@/lib/i18n/client";

export function ChangePasswordForm() {
  const t = useTranslations();
  const p = t.settings.password;
  const [state, action, pending] = useActionState(changePassword, null);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">{p.current}</Label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="newPassword">{p.new}</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            placeholder={t.auth.passwordHint}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">{p.confirm}</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
        </div>
      </div>
      {state && "errorKey" in state && (
        <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{p.errors[state.errorKey]}</p>
      )}
      {state && "changed" in state && (
        <p className="text-sm text-emerald-400 bg-emerald-500/10 rounded px-3 py-2">{p.changed}</p>
      )}
      <Button type="submit" size="sm" disabled={pending} className="gap-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {p.submit}
      </Button>
    </form>
  );
}

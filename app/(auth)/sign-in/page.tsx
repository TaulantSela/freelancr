"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Loader2 } from "lucide-react";
import { signIn } from "@/lib/actions/auth";
import { useTranslations } from "@/lib/i18n/client";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { AuthErrorKey } from "@/lib/i18n/format";

export default function SignInPage() {
  const t = useTranslations();
  const [errorKey, setErrorKey] = useState<AuthErrorKey | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorKey(null);
    const fd = new FormData(e.currentTarget);
    const result = await signIn(fd);
    if (result?.errorKey) {
      setErrorKey(result.errorKey);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <LanguageSwitcher compact />
        </div>
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-primary flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">{t.common.appName}</span>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t.auth.welcomeBack}</CardTitle>
            <CardDescription>{t.auth.signInDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">{t.auth.email}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="your@email.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t.auth.password}</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>

              {errorKey && (
                <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
                  {t.auth.errors[errorKey]}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t.auth.signIn}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              {t.auth.noAccount}{" "}
              <Link href="/sign-up" className="text-primary hover:underline">
                {t.auth.goToSignUp}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

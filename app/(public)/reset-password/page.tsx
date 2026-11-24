import Link from "next/link";
import { getDb } from "@/lib/db";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getTranslations } from "@/lib/i18n/server";
import { hashResetToken, isResetTokenUsable } from "@/lib/auth/reset";

// From the link in the email. A token that's invalid, expired or used gets
// one message and a way to ask for a new link.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { t } = await getTranslations();
  const r = t.auth.reset;
  const { token } = await searchParams;
  const usable = typeof token === "string" && token.length > 0 && token.length < 200
    && (await isResetTokenUsable(getDb(), hashResetToken(token)));
  return (
    <AuthCard appName={t.common.appName} title={r.title} description={usable ? r.desc : undefined}>
      {usable ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="space-y-4">
          <p className="text-sm">{r.invalid}</p>
          <Link href="/forgot-password" className="text-sm underline underline-offset-2">
            {r.requestNew}
          </Link>
        </div>
      )}
    </AuthCard>
  );
}

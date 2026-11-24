import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getTranslations } from "@/lib/i18n/server";
import { isEmailConfigured } from "@/lib/email/config";

export default async function ForgotPasswordPage() {
  const { t } = await getTranslations();
  const f = t.auth.forgot;
  return (
    <AuthCard appName={t.common.appName} title={f.title} description={isEmailConfigured() ? f.desc : undefined}>
      {isEmailConfigured() ? (
        <ForgotPasswordForm />
      ) : (
        <p className="text-sm text-muted-foreground">{f.notConfigured}</p>
      )}
    </AuthCard>
  );
}

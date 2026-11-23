import { getSession } from "@/lib/auth/session";
import { getDb, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { getTranslations } from "@/lib/i18n/server";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { t } = await getTranslations();

  // The profile goes to a client component, so select what it shows rather
  // than the whole row (which includes the password hash).
  const [user] = await getDb()
    .select({
      email: users.email,
      createdAt: users.createdAt,
      name: users.name,
      businessName: users.businessName,
      taxStatus: users.taxStatus,
      monthlyAdvanceMKD: users.monthlyAdvanceMKD,
      vatRegistered: users.vatRegistered,
      vatNumber: users.vatNumber,
      taxNumber: users.taxNumber,
      address: users.address,
      placeOfIssue: users.placeOfIssue,
      signatoryName: users.signatoryName,
      bankName: users.bankName,
      bankAccount: users.bankAccount,
      iban: users.iban,
      bic: users.bic,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user) redirect("/sign-in");

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t.settings.title}</h1>
        <p className="text-sm text-muted-foreground">{t.settings.subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t.settings.businessProfile}</CardTitle>
          <CardDescription>{t.settings.profileDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm user={user} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t.settings.account}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t.settings.email}</span>
            <span className="font-mono text-xs">{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t.settings.memberSince}</span>
            <span className="text-xs text-muted-foreground">{user.createdAt?.slice(0, 10)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

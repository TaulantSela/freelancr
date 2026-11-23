import { getSession } from "@/lib/auth/session";
import { getDb, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { getTranslations } from "@/lib/i18n/server";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { t } = await getTranslations();

  const [user] = await getDb()
    .select()
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
            <span className="text-muted-foreground">{t.settings.plan}</span>
            <Badge variant="outline" className="text-xs">{t.settings.freePlan}</Badge>
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

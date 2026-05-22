import { getSession } from "@/lib/auth/session";
import { getDb, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { getTranslations } from "@/lib/i18n/server";
import { formatMessage } from "@/lib/i18n/format";

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

  const readinessItems = [
    { done: !!user.taxNumber },
    { done: !!user.businessName },
    { done: !!user.address },
    { done: !!user.bankAccount },
    { done: user.businessType !== "personal" },
    { done: true },
  ];
  const doneCount = readinessItems.filter((i) => i.done).length;

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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            {t.settings.eFakturaTitle}
            <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500/30">
              {t.landing.eFakturaAlert}
            </Badge>
          </CardTitle>
          <CardDescription>
            {formatMessage(t.settings.requirementsMet, {
              done: doneCount,
              total: readinessItems.length,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {t.settings.checklist.map((label, i) => (
              <div key={label} className="flex items-center gap-3 text-sm">
                <div
                  className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                    readinessItems[i].done
                      ? "bg-emerald-500 border-emerald-500"
                      : "border-muted-foreground"
                  }`}
                >
                  {readinessItems[i].done && (
                    <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
                <span className={readinessItems[i].done ? "text-muted-foreground line-through" : ""}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

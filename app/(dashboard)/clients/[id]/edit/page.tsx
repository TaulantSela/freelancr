import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ClientForm } from "@/components/clients/client-form";
import { getSession } from "@/lib/auth/session";
import { getDb, clients } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getTranslations } from "@/lib/i18n/server";
import { getCountryOptions } from "@/lib/clients/countries";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const { t, locale } = await getTranslations();

  const [client] = await getDb()
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.userId, session.userId)))
    .limit(1);

  if (!client) notFound();

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/clients">
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> {t.nav.clients}
          </Button>
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">{t.clients.editBreadcrumb}</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.clients.editTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientForm client={client} countries={getCountryOptions(locale)} />
        </CardContent>
      </Card>
    </div>
  );
}

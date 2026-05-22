import { getSession } from "@/lib/auth/session";
import { getDb, clients } from "@/lib/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewInvoiceForm } from "@/components/invoices/new-invoice-form";
import { getTranslations } from "@/lib/i18n/server";

export default async function NewInvoicePage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { t } = await getTranslations();

  const clientList = await getDb()
    .select({ id: clients.id, name: clients.name, currency: clients.currency })
    .from(clients)
    .where(eq(clients.userId, session.userId));

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/invoices">
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> {t.nav.invoices}
          </Button>
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">{t.invoices.newBreadcrumb}</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.invoices.newTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {clientList.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-4">{t.invoices.needClient}</p>
              <Link href="/clients/new">
                <Button size="sm">{t.invoices.addFirstClient}</Button>
              </Link>
            </div>
          ) : (
            <NewInvoiceForm clients={clientList} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

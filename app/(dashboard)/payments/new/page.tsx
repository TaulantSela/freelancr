import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getDb, clients } from "@/lib/db";
import { getTranslations } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toSkopjeDate } from "@/lib/tax/calculator";
import { getTaxProfile } from "@/lib/tax/queries";
import { getPayableInvoices } from "@/lib/payments/queries";
import { PaymentForm } from "@/components/payments/payment-form";

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { t } = await getTranslations();
  const { invoice } = await searchParams;
  const [{ taxStatus }, invoices, clientList] = await Promise.all([
    getTaxProfile(session.userId),
    getPayableInvoices(session.userId),
    getDb()
      .select({
        id: clients.id,
        name: clients.name,
        country: clients.country,
        clientType: clients.clientType,
        currency: clients.currency,
        deemedCostsRate: clients.deemedCostsRate,
      })
      .from(clients)
      .where(eq(clients.userId, session.userId))
      .orderBy(clients.name),
  ]);
  const preset = invoices.find((i) => i.id === invoice);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={preset ? `/invoices/${preset.id}` : "/payments"}>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> {preset ? preset.number : t.payments.title}
          </Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.payments.form.newTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {clientList.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.payments.form.needClient}</p>
          ) : (
            <PaymentForm
              taxStatus={taxStatus}
              today={toSkopjeDate(new Date())}
              invoices={invoices}
              clients={clientList}
              presetInvoiceId={preset?.id}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

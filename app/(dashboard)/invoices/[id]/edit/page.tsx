import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { getSession } from "@/lib/auth/session";
import { getDb, clients, invoices, invoiceItems, users } from "@/lib/db";
import { addDays, toSkopjeDate } from "@/lib/tax/calculator";
import { getTranslations } from "@/lib/i18n/server";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const { t } = await getTranslations();

  const [invoice] = await getDb()
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.userId, session.userId)))
    .limit(1);
  if (!invoice) notFound();
  // Only drafts can be edited; an issued invoice is locked.
  if (invoice.status !== "draft") redirect(`/invoices/${id}`);

  const items = await getDb()
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, id));

  const clientList = await getDb()
    .select({ id: clients.id, name: clients.name, currency: clients.currency })
    .from(clients)
    .where(eq(clients.userId, session.userId));

  const [user] = await getDb()
    .select({ vatRegistered: users.vatRegistered })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  const today = toSkopjeDate(new Date());

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/invoices/${id}`}>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> {invoice.number ?? t.invoices.standing.draft}
          </Button>
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">{t.common.edit}</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.invoices.editTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <InvoiceForm
            clients={clientList}
            vatRegistered={user?.vatRegistered ?? false}
            today={today}
            dueDefault={addDays(today, 30)}
            draft={{
              id: invoice.id,
              clientId: invoice.clientId,
              date: invoice.date,
              supplyDate: invoice.supplyDate ?? invoice.date,
              dueDate: invoice.dueDate,
              currency: invoice.currency,
              ddvRate: invoice.ddvRate,
              notes: invoice.notes,
              items: items.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
              })),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

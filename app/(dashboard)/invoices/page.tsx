import { getSession } from "@/lib/auth/session";
import { getDb, invoices, clients } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus, FileText } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { formatCurrency, formatMKD } from "@/lib/tax/calculator";
import { InvoiceStatusButton } from "@/components/invoices/invoice-status-button";
import { getTranslations } from "@/lib/i18n/server";
import { formatMessage } from "@/lib/i18n/format";

export default async function InvoicesPage() {
  const session = await getSession();
  if (!session) return null;

  const { t } = await getTranslations();

  const invoiceList = await getDb()
    .select({
      id: invoices.id,
      number: invoices.number,
      date: invoices.date,
      currency: invoices.currency,
      total: invoices.total,
      totalMKD: invoices.totalMKD,
      status: invoices.status,
      clientName: clients.name,
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.userId, session.userId))
    .orderBy(invoices.createdAt);

  const paidTotal = invoiceList.filter((i) => i.status === "paid").reduce((s, i) => s + i.totalMKD, 0);
  // Issued and not paid yet, overdue or not.
  const sentTotal = invoiceList
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + i.totalMKD, 0);
  const draftCount = invoiceList.filter((i) => i.status === "draft").length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t.invoices.title}</h1>
          <p className="text-sm text-muted-foreground">
            {formatMessage(t.invoices.count, { count: invoiceList.length })}
          </p>
        </div>
        <Link href="/invoices/new">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> {t.invoices.newInvoice}
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t.invoices.paidMkd}</div>
            <div className="text-lg font-mono font-semibold text-emerald-400">{formatMKD(paidTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t.invoices.outstandingMkd}</div>
            <div className="text-lg font-mono font-semibold text-blue-400">{formatMKD(sentTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t.invoices.drafts}</div>
            <div className="text-lg font-mono font-semibold">{draftCount}</div>
          </CardContent>
        </Card>
      </div>

      {invoiceList.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-sm font-medium mb-2">{t.invoices.emptyTitle}</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">{t.invoices.emptyDesc}</p>
            <Link href="/invoices/new">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> {t.invoices.createFirst}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-0 text-xs text-muted-foreground uppercase tracking-wider px-4 py-2 border-b border-border">
              <div className="w-32">{t.invoices.colNumber}</div>
              <div>{t.invoices.colClient}</div>
              <div className="w-28 text-right">{t.invoices.colAmount}</div>
              <div className="w-28 text-right">{t.invoices.colMkd}</div>
              <div className="w-28 text-right">{t.invoices.colStatus}</div>
            </div>
            {invoiceList.map((inv, i) => (
              <div key={inv.id}>
                <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-0 items-center px-4 py-3">
                  <div className="w-32">
                    <Link
                      href={`/invoices/${inv.id}`}
                      className={cn(
                        "text-sm font-medium hover:underline",
                        inv.number ? "font-mono" : "italic text-muted-foreground"
                      )}
                    >
                      {inv.number ?? t.invoices.status.draft}
                    </Link>
                    <div className="text-xs text-muted-foreground mt-0.5">{formatDate(inv.date)}</div>
                  </div>
                  <div className="text-sm">{inv.clientName ?? "—"}</div>
                  <div className="w-28 text-right font-mono text-sm">
                    {formatCurrency(inv.total, inv.currency)}
                  </div>
                  <div className="w-28 text-right font-mono text-xs text-muted-foreground">
                    {formatMKD(inv.totalMKD)}
                  </div>
                  <div className="w-28 flex justify-end">
                    <InvoiceStatusButton id={inv.id} currentStatus={inv.status} />
                  </div>
                </div>
                {i < invoiceList.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

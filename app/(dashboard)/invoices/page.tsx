import { getSession } from "@/lib/auth/session";
import { getDb, invoices, clients } from "@/lib/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus, FileText } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { formatCurrency, formatMKD, toSkopjeDate } from "@/lib/tax/calculator";
import { InvoiceStandingBadge } from "@/components/invoices/invoice-standing-badge";
import { getSettledByInvoice } from "@/lib/payments/queries";
import { invoiceStanding } from "@/lib/payments/settlement";
import { getCreditedByInvoice } from "@/lib/credit-notes/queries";
import { getTranslations } from "@/lib/i18n/server";
import { formatMessage } from "@/lib/i18n/format";

export default async function InvoicesPage() {
  const session = await getSession();
  if (!session) return null;

  const { t } = await getTranslations();

  const [rows, settledByInvoice, creditedByInvoice] = await Promise.all([
    getDb()
      .select({
        id: invoices.id,
        number: invoices.number,
        date: invoices.date,
        dueDate: invoices.dueDate,
        currency: invoices.currency,
        total: invoices.total,
        totalMKD: invoices.totalMKD,
        exchangeRateMKD: invoices.exchangeRateMKD,
        status: invoices.status,
        clientName: clients.name,
      })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(eq(invoices.userId, session.userId))
      .orderBy(invoices.createdAt),
    getSettledByInvoice(session.userId),
    getCreditedByInvoice(session.userId),
  ]);

  // Where each invoice stands, from its payments, credit notes and due date.
  const today = toSkopjeDate(new Date());
  const invoiceList = rows.map((inv) => ({
    ...inv,
    standing: invoiceStanding(
      inv,
      settledByInvoice.get(inv.id) ?? 0,
      today,
      creditedByInvoice.get(inv.id) ?? 0
    ),
  }));
  const counted = invoiceList.filter((i) => i.status !== "draft" && i.status !== "cancelled");
  // In MKD at each invoice's rate: what its payments covered (up to what's
  // due after credit notes), and what's still to pay.
  const paidTotal = counted.reduce(
    (s, i) =>
      s + Math.min(i.standing.settled, Math.max(0, i.total - i.standing.credited)) * i.exchangeRateMKD,
    0
  );
  const outstandingTotal = counted.reduce((s, i) => s + i.standing.balance * i.exchangeRateMKD, 0);
  const draftCount = invoiceList.filter((i) => i.status === "draft").length;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
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

      <div className="grid sm:grid-cols-3 gap-2 sm:gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t.invoices.paidMkd}</div>
            <div className="text-lg font-mono font-semibold text-emerald-400">{formatMKD(paidTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t.invoices.outstandingMkd}</div>
            <div className="text-lg font-mono font-semibold text-blue-400">{formatMKD(outstandingTotal)}</div>
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
            <div className="hidden sm:grid grid-cols-[8rem_1fr_8rem_8rem_7rem] gap-3 text-xs text-muted-foreground uppercase tracking-wider px-4 py-2 border-b border-border">
              <div>{t.invoices.colNumber}</div>
              <div>{t.invoices.colClient}</div>
              <div className="text-right">{t.invoices.colAmount}</div>
              <div className="text-right">{t.invoices.colBalance}</div>
              <div className="text-right">{t.invoices.colStatus}</div>
            </div>
            {invoiceList.map((inv, i) => {
              const showBalance = inv.status !== "draft" && inv.status !== "cancelled";
              return (
                <div key={inv.id}>
                  <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[8rem_1fr_8rem_8rem_7rem] gap-x-3 gap-y-1 items-center px-4 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className={cn(
                          "text-sm font-medium hover:underline",
                          inv.number ? "font-mono" : "italic text-muted-foreground"
                        )}
                      >
                        {inv.number ?? t.invoices.standing.draft}
                      </Link>
                      <div className="text-xs text-muted-foreground mt-0.5">{formatDate(inv.date)}</div>
                    </div>
                    <div className="text-sm min-w-0 truncate max-sm:order-3">{inv.clientName ?? "—"}</div>
                    <div className="text-right max-sm:order-2">
                      <div className="font-mono text-sm">{formatCurrency(inv.total, inv.currency)}</div>
                      {inv.currency !== "MKD" && (
                        <div className="font-mono text-xs text-muted-foreground">{formatMKD(inv.totalMKD)}</div>
                      )}
                    </div>
                    <div
                      className={cn(
                        "text-right font-mono text-sm max-sm:order-5 max-sm:col-span-2 max-sm:text-xs",
                        inv.standing.status === "overdue" && "text-red-400",
                        inv.standing.balance === 0 && "text-muted-foreground",
                        !showBalance && "max-sm:hidden"
                      )}
                    >
                      {showBalance && (
                        <>
                          <span className="sm:hidden text-muted-foreground">{t.invoices.colBalance}: </span>
                          {formatCurrency(inv.standing.balance, inv.currency)}
                          {inv.standing.credited > 0 && (
                            <div className="text-xs text-muted-foreground max-sm:inline max-sm:ml-2">
                              {formatMessage(t.creditNotes.creditedShort, {
                                amount: formatCurrency(inv.standing.credited, inv.currency),
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex justify-end max-sm:order-4">
                      <InvoiceStandingBadge status={inv.standing.status} />
                    </div>
                  </div>
                  {i < invoiceList.length - 1 && <Separator />}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

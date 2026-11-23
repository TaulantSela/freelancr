import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getInvoiceDetail } from "@/lib/invoices/queries";
import { formatDate } from "@/lib/utils";
import { formatCurrency, formatMKD, toSkopjeDate } from "@/lib/tax/calculator";
import { InvoiceStandingBadge } from "@/components/invoices/invoice-standing-badge";
import { DeleteInvoiceButton } from "@/components/invoices/delete-invoice-button";
import { DownloadPdfButton } from "@/components/invoices/download-pdf-button";
import { IssueInvoiceButton } from "@/components/invoices/issue-invoice-button";
import { CancelInvoiceButton } from "@/components/invoices/cancel-invoice-button";
import { getTranslations } from "@/lib/i18n/server";
import { LOCALE_LABELS } from "@/lib/i18n/config";
import { resolveInvoiceLanguage } from "@/lib/clients/config";
import { formatMessage } from "@/lib/i18n/format";
import { formatTaxDate } from "@/lib/tax/labels";
import { getInvoicePayments } from "@/lib/payments/queries";
import { invoiceStanding, settledAmount } from "@/lib/payments/settlement";
import { cn } from "@/lib/utils";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const { t } = await getTranslations();

  const [data, payments] = await Promise.all([
    getInvoiceDetail(id, session.userId),
    getInvoicePayments(id, session.userId),
  ]);
  if (!data) notFound();

  const { invoice, items, client, user } = data;
  const fromName = user.businessName || user.name;
  const ddvPct = Math.round(invoice.ddvRate * 100);
  const isDraft = invoice.status === "draft";
  const title = invoice.number ?? t.invoices.standing.draft;
  // Labels for the issuer's details, in the app's language.
  const pdf = t.invoices.pdf;
  const invoiceLanguage = resolveInvoiceLanguage(client);
  // Paid, partly paid or overdue come from the payments and the due date.
  const standing = invoiceStanding(invoice, settledAmount(payments), toSkopjeDate(new Date()));
  const issued = !isDraft && invoice.status !== "cancelled" && invoice.number !== null;
  const ip = t.invoices.payments;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/invoices">
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" /> {t.nav.invoices}
            </Button>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-mono font-medium">{title}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDraft && (
            <Link href={`/invoices/${invoice.id}/edit`}>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                {t.common.edit}
              </Button>
            </Link>
          )}
          {isDraft && <IssueInvoiceButton id={invoice.id} year={invoice.date.slice(0, 4)} />}
          <DownloadPdfButton invoiceId={invoice.id} />
          {/* Drafts can be deleted; issued invoices only cancelled, since
              they're kept for five years (VAT law Art. 56). */}
          {isDraft && <DeleteInvoiceButton id={invoice.id} number={invoice.number} />}
          {/* With payments recorded it can't be cancelled (delete them first). */}
          {issued && invoice.number && payments.length === 0 && (
            <CancelInvoiceButton id={invoice.id} number={invoice.number} />
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-mono">{title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{fromName}</p>
            </div>
            <InvoiceStandingBadge status={standing.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                {t.invoices.detail.from}
              </p>
              <p className="font-medium text-sm">{fromName}</p>
              {user.name !== fromName && (
                <p className="text-sm text-muted-foreground">{user.name}</p>
              )}
              {user.address && (
                <p className="text-sm text-muted-foreground">{user.address}</p>
              )}
              {user.taxNumber && (
                <p className="text-sm text-muted-foreground">
                  {pdf.taxNumber}: {user.taxNumber}
                </p>
              )}
              {user.vatRegistered && user.vatNumber ? (
                <p className="text-sm text-muted-foreground">
                  {pdf.vatNumber}: {user.vatNumber}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">{pdf.notVatRegistered}</p>
              )}
              {(user.bank.iban || user.bank.accountNumber) && (
                <div className="text-sm text-muted-foreground mt-1">
                  {user.bank.bankName && <p>{user.bank.bankName}</p>}
                  {user.bank.iban && (
                    <p className="font-mono text-xs">
                      {pdf.iban}: {user.bank.iban}
                      {user.bank.bic && ` · ${pdf.bic}: ${user.bank.bic}`}
                    </p>
                  )}
                  {user.bank.accountNumber && (
                    <p className="font-mono text-xs">
                      {pdf.accountNumber}: {user.bank.accountNumber}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                {t.invoices.detail.billTo}
              </p>
              <p className="font-medium text-sm">{client.name}</p>
              {client.contactPerson && (
                <p className="text-sm text-muted-foreground">{client.contactPerson}</p>
              )}
              {client.taxId && (
                <p className="text-sm text-muted-foreground">{client.taxId}</p>
              )}
              {client.address && (
                <p className="text-sm text-muted-foreground">{client.address}</p>
              )}
              {client.email && (
                <p className="text-sm text-muted-foreground">{client.email}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">{t.invoices.form.invoiceDate}</p>
              <p className="font-medium">{formatDate(invoice.date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t.invoices.form.supplyDate}</p>
              <p className="font-medium">{formatDate(invoice.supplyDate)}</p>
            </div>
            {invoice.dueDate && (
              <div>
                <p className="text-xs text-muted-foreground">{t.invoices.form.dueDate}</p>
                <p className="font-medium">{formatDate(invoice.dueDate)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">{t.invoices.form.currency}</p>
              <p className="font-medium">{invoice.currency}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t.clients.form.invoiceLanguage}</p>
              <p className="font-medium">{LOCALE_LABELS[invoiceLanguage]}</p>
            </div>
            {user.placeOfIssue && (
              <div>
                <p className="text-xs text-muted-foreground">{pdf.placeOfIssue}</p>
                <p className="font-medium">{user.placeOfIssue}</p>
              </div>
            )}
            {invoice.currency !== "MKD" && (
              <div>
                <p className="text-xs text-muted-foreground">{t.invoices.detail.exchangeRate}</p>
                <p className="font-medium font-mono text-xs">
                  {invoice.rateSource === "nbrsm" && invoice.rateDate
                    ? formatMessage(t.invoices.form.nbrsmRate, {
                        currency: invoice.currency,
                        rate: String(invoice.exchangeRateMKD),
                        date: formatTaxDate(invoice.rateDate, t),
                      })
                    : formatMessage(t.invoices.form.approximateRate, {
                        currency: invoice.currency,
                        rate: String(invoice.exchangeRateMKD),
                      })}
                </p>
              </div>
            )}
          </div>

          <Separator />

          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              {t.invoices.form.lineItems}
            </p>
            <div className="space-y-0 border border-border rounded-lg overflow-hidden">
              <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 bg-muted/40 text-xs text-muted-foreground uppercase tracking-wider">
                <div>{t.invoices.form.description}</div>
                <div className="w-12 text-right">{t.invoices.form.qty}</div>
                <div className="w-32 text-right">{t.invoices.form.unitPrice.replace("{currency}", invoice.currency)}</div>
                <div className="w-32 text-right">{t.invoices.form.total}</div>
              </div>
              {/* On phones: the description with quantity x price under it,
                  and the line total. */}
              {items.map((item, i) => (
                <div
                  key={item.id}
                  className={`grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-3 text-sm items-center ${
                    i < items.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <div className="min-w-0">
                    {item.description}
                    <div className="sm:hidden text-xs text-muted-foreground font-mono">
                      {item.quantity} × {formatCurrency(item.unitPrice, invoice.currency)}
                    </div>
                  </div>
                  <div className="hidden sm:block w-12 text-right font-mono">{item.quantity}</div>
                  <div className="hidden sm:block w-32 text-right font-mono">
                    {formatCurrency(item.unitPrice, invoice.currency)}
                  </div>
                  <div className="sm:w-32 text-right font-mono font-medium whitespace-nowrap">
                    {formatCurrency(item.total, invoice.currency)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.invoices.form.subtotal}</span>
                <span className="font-mono">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
              </div>
              {invoice.ddvRate > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t.invoices.form.ddv} ({ddvPct}%)
                  </span>
                  <span className="font-mono">{formatCurrency(invoice.ddvAmount, invoice.currency)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-medium">
                <span>{t.invoices.form.total}</span>
                <span className="font-mono">{formatCurrency(invoice.total, invoice.currency)}</span>
              </div>
              {invoice.currency !== "MKD" && (
                <div className="flex justify-between text-muted-foreground text-xs pt-1">
                  <span>{t.invoices.form.mkdEquivalent}</span>
                  <span className="font-mono">{formatMKD(invoice.totalMKD)}</span>
                </div>
              )}
            </div>
          </div>

          {invoice.notes && (
            <>
              <Separator />
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  {t.invoices.form.notes}
                </p>
                <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            </>
          )}

          {invoice.paidAt && (
            <p className="text-xs text-muted-foreground">
              {t.invoices.detail.paidOn}: {formatDate(invoice.paidAt.split("T")[0])}
            </p>
          )}

          {invoice.status === "cancelled" && (
            <p className="text-xs text-muted-foreground">{t.invoices.cancel.note}</p>
          )}
        </CardContent>
      </Card>

      {(issued || payments.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex flex-wrap items-center justify-between gap-2">
              <span>{ip.title}</span>
              {issued && standing.balance > 0 && (
                <Link href={`/payments/new?invoice=${invoice.id}`}>
                  <Button size="sm" className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> {ip.record}
                  </Button>
                </Link>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{ip.none}</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {payments.map((p) => (
                  <li key={p.id} className="px-3 py-2.5 text-sm space-y-0.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span>{formatTaxDate(p.receivedOn, t)}</span>
                      <span className="font-mono">{formatCurrency(p.amount, p.currency)}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>
                        {[
                          p.channel && t.payments.channels[p.channel],
                          p.fees > 0 && formatMessage(t.payments.feesLine, { amount: formatCurrency(p.fees, p.currency) }),
                          p.taxWithheld > 0 &&
                            formatMessage(t.payments.withheldLine, { amount: formatCurrency(p.taxWithheld, p.currency) }),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <Link href={`/payments/${p.id}/edit`} className="underline underline-offset-2 hover:text-foreground">
                        {t.common.edit}
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-1.5 text-sm sm:max-w-xs sm:ml-auto">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t.invoices.form.total}</span>
                <span className="font-mono">{formatCurrency(invoice.total, invoice.currency)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{ip.settled}</span>
                <span className="font-mono">{formatCurrency(standing.settled, invoice.currency)}</span>
              </div>
              <Separator />
              {standing.overpaid > 0 ? (
                <div className="flex justify-between gap-4 font-medium text-amber-400">
                  <span>{ip.overpaid}</span>
                  <span className="font-mono">{formatCurrency(standing.overpaid, invoice.currency)}</span>
                </div>
              ) : (
                <div
                  className={cn(
                    "flex justify-between gap-4 font-medium",
                    standing.status === "overdue" && "text-red-400"
                  )}
                >
                  <span>{ip.balanceDue}</span>
                  <span className="font-mono">{formatCurrency(standing.balance, invoice.currency)}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {ip.settledNote}
              {issued && payments.length > 0 && ` ${ip.cancelHint}`}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

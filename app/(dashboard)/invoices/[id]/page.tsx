import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Pencil } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getInvoiceDetail } from "@/lib/invoices/queries";
import { formatDate } from "@/lib/utils";
import { formatCurrency, formatMKD } from "@/lib/tax/calculator";
import { InvoiceStatusButton } from "@/components/invoices/invoice-status-button";
import { DeleteInvoiceButton } from "@/components/invoices/delete-invoice-button";
import { DownloadPdfButton } from "@/components/invoices/download-pdf-button";
import { IssueInvoiceButton } from "@/components/invoices/issue-invoice-button";
import { CancelInvoiceButton } from "@/components/invoices/cancel-invoice-button";
import { getTranslations } from "@/lib/i18n/server";
import { LOCALE_LABELS } from "@/lib/i18n/config";
import { resolveInvoiceLanguage } from "@/lib/clients/config";
import { formatMessage } from "@/lib/i18n/format";
import { formatTaxDate } from "@/lib/tax/labels";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const { t } = await getTranslations();

  const data = await getInvoiceDetail(id, session.userId);
  if (!data) notFound();

  const { invoice, items, client, user } = data;
  const fromName = user.businessName || user.name;
  const ddvPct = Math.round(invoice.ddvRate * 100);
  const isDraft = invoice.status === "draft";
  const title = invoice.number ?? t.invoices.status.draft;
  // Labels for the issuer's details, in the app's language.
  const pdf = t.invoices.pdf;
  const invoiceLanguage = resolveInvoiceLanguage(client);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
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
        <div className="flex items-center gap-2">
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
          {!isDraft && invoice.status !== "cancelled" && invoice.number && (
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
            <InvoiceStatusButton id={invoice.id} currentStatus={invoice.status} />
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
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 bg-muted/40 text-xs text-muted-foreground uppercase tracking-wider">
                <div>{t.invoices.form.description}</div>
                <div className="w-12 text-right">{t.invoices.form.qty}</div>
                <div className="w-24 text-right">{t.invoices.form.unitPrice.replace("{currency}", invoice.currency)}</div>
                <div className="w-24 text-right">{t.invoices.form.total}</div>
              </div>
              {items.map((item, i) => (
                <div
                  key={item.id}
                  className={`grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-3 text-sm items-center ${
                    i < items.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <div>{item.description}</div>
                  <div className="w-12 text-right font-mono">{item.quantity}</div>
                  <div className="w-24 text-right font-mono">
                    {formatCurrency(item.unitPrice, invoice.currency)}
                  </div>
                  <div className="w-24 text-right font-mono font-medium">
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
    </div>
  );
}

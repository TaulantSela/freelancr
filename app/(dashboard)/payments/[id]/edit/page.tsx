import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getTranslations } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toSkopjeDate } from "@/lib/tax/calculator";
import { getTaxProfile } from "@/lib/tax/queries";
import { getPayment } from "@/lib/payments/queries";
import { PaymentForm } from "@/components/payments/payment-form";
import { DeletePaymentButton } from "@/components/payments/delete-payment-button";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { getPaymentAttachments } from "@/lib/attachments/queries";

export default async function EditPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const { t } = await getTranslations();
  const [payment, { taxStatus }, files] = await Promise.all([
    getPayment(id, session.userId),
    getTaxProfile(session.userId),
    getPaymentAttachments(id, session.userId),
  ]);
  if (!payment) notFound();
  // Its month is already with UJP: changing it changes that month's tax.
  const filed = payment.ujpStatus === "filed" || payment.ujpStatus === "approved" || payment.ujpStatus === "paid";
  const back = payment.invoiceId
    ? { href: `/invoices/${payment.invoiceId}`, label: payment.invoiceNumber ?? t.payments.title }
    : { href: `/payments?year=${payment.receivedOn.slice(0, 4)}`, label: t.payments.title };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={back.href}>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> {back.label}
          </Button>
        </Link>
        <DeletePaymentButton id={payment.id} attachmentCount={files.length} filed={filed} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.payments.form.editTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentForm
            taxStatus={taxStatus}
            today={toSkopjeDate(new Date())}
            invoices={[]}
            clients={[]}
            existing={{ ...payment, taxTreatment: payment.taxTreatment }}
            filed={filed}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.attachments.proofTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <AttachmentList owner={{ paymentId: payment.id }} items={files} />
        </CardContent>
      </Card>
    </div>
  );
}

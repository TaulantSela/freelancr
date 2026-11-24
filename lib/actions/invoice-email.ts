"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { generateId } from "@/lib/utils";
import { getInvoiceDetail } from "@/lib/invoices/queries";
import { completeInvoiceEmail, reserveInvoiceEmail } from "@/lib/invoices/emails";
import { renderInvoicePdf } from "@/lib/pdf/render";
import { isEmailConfigured, mailFromAs } from "@/lib/email/config";
import { DAILY_CAP_ERROR, sendEmail } from "@/lib/email/send";
import { emailHtml } from "@/lib/email/html";

export type InvoiceEmailErrorKey =
  | "toInvalid"
  | "subjectRequired"
  | "notIssued"
  | "dailyLimit"
  | "notConfigured"
  | "demo"
  | "sendFailed"
  | "appDailyCap";

// One address: no spaces, commas, semicolons, quotes or angle brackets.
const ADDRESS = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

// Emails an issued invoice to the client: the PDF attached (the same
// renderer as the download), from "<name> via Freelancr" on MAIL_FROM's
// address, replies to the account's email, a copy to it if asked. At most
// 20 a day. Everything the user typed is escaped in the HTML.
export async function emailInvoice(
  invoiceId: string,
  formData: FormData
): Promise<{ errorKey: InvoiceEmailErrorKey } | { sent: true; to: string }> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (session.isDemo) return { errorKey: "demo" };
  if (!isEmailConfigured()) return { errorKey: "notConfigured" };

  const to = String(formData.get("to") ?? "").trim();
  if (to.length > 254 || !ADDRESS.test(to)) return { errorKey: "toInvalid" };
  const subject = String(formData.get("subject") ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 200);
  if (!subject) return { errorKey: "subjectRequired" };
  const message = String(formData.get("message") ?? "").slice(0, 5000);
  const copy = formData.get("copy") === "on";

  const data = await getInvoiceDetail(invoiceId, session.userId);
  if (!data || !data.invoice.number || !["sent", "paid", "overdue"].includes(data.invoice.status)) {
    return { errorKey: "notIssued" };
  }
  const from = mailFromAs(data.user.businessName || data.user.name);
  if (!from) return { errorKey: "notConfigured" };

  const id = generateId();
  if (!(await reserveInvoiceEmail(getDb(), { id, userId: session.userId, invoiceId, toAddress: to }))) {
    return { errorKey: "dailyLimit" };
  }
  const pdf = await renderInvoicePdf(data);
  const result = await sendEmail({
    kind: "invoice",
    from,
    to,
    subject,
    text: message,
    html: emailHtml({ paragraphs: message.split(/\r?\n\s*\r?\n/).filter((p) => p.trim()) }),
    replyTo: session.email,
    ...(copy ? { bcc: session.email } : {}),
    attachments: [{ filename: `${data.invoice.number}.pdf`, content: pdf.toString("base64") }],
  });
  await completeInvoiceEmail(getDb(), id, result.ok ? { providerId: result.id ?? id } : { error: result.error });

  revalidatePath(`/invoices/${invoiceId}`);
  if (result.ok) return { sent: true, to };
  // Over the app's daily cap (all email, for every user) or a failed send.
  return { errorKey: result.error === DAILY_CAP_ERROR ? "appDailyCap" : "sendFailed" };
}

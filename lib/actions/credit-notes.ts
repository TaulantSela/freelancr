"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, creditNotes, invoices } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { generateId } from "@/lib/utils";
import { toSkopjeDate } from "@/lib/tax/calculator";
import { fitsCreditable, roundCents } from "@/lib/credit-notes/amounts";
import { deleteLatestCreditNote, insertCreditNote } from "@/lib/credit-notes/write";

export type CreditNoteErrorKey =
  | "dateInvalid"
  | "dateFuture"
  | "dateBeforeInvoice"
  | "amountInvalid"
  | "amountTooHigh"
  | "reasonRequired"
  | "notIssued";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function refresh(invoiceId: string) {
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/dashboard");
  revalidatePath("/payments");
}

// Issues a credit note on one of the user's issued, not cancelled invoices:
// dated on or before today and not before the invoice, for more than 0 and
// at most what's left to credit, with a reason. Its number is assigned as
// it's written (lib/credit-notes/write.ts).
export async function createCreditNote(
  invoiceId: string,
  formData: FormData
): Promise<{ errorKey: CreditNoteErrorKey } | { number: string }> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const today = toSkopjeDate(new Date());

  const date = String(formData.get("date") ?? "");
  if (!isRealDate(date)) return { errorKey: "dateInvalid" };
  if (date > today) return { errorKey: "dateFuture" };
  const amount = Number(String(formData.get("amount") ?? "").trim().replace(",", "."));
  if (!Number.isFinite(amount) || !(amount > 0)) return { errorKey: "amountInvalid" };
  const roundedAmount = roundCents(amount);
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (!reason) return { errorKey: "reasonRequired" };

  const [invoice] = await getDb()
    .select({
      date: invoices.date,
      total: invoices.total,
      number: invoices.number,
      credited: sql<number>`coalesce((select sum(${creditNotes.amount}) from ${creditNotes} where ${creditNotes.invoiceId} = ${invoices.id}), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.id, invoiceId),
        eq(invoices.userId, session.userId),
        inArray(invoices.status, ["sent", "paid", "overdue"])
      )
    )
    .limit(1);
  if (!invoice || !invoice.number) return { errorKey: "notIssued" };
  if (date < invoice.date) return { errorKey: "dateBeforeInvoice" };
  if (!fitsCreditable(roundedAmount, invoice.total, Number(invoice.credited))) {
    return { errorKey: "amountTooHigh" };
  }

  const number = await insertCreditNote(getDb(), {
    id: generateId(),
    userId: session.userId,
    invoiceId,
    date,
    amount: roundedAmount,
    reason,
  });
  // Written by nothing: cancelled or credited in between.
  if (!number) return { errorKey: "amountTooHigh" };

  refresh(invoiceId);
  return { number };
}

// Deletes one of the user's credit notes, if it's their most recent one.
export async function deleteCreditNote(
  id: string
): Promise<{ errorKey: "notLatest" } | { ok: true }> {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const [note] = await getDb()
    .select({ invoiceId: creditNotes.invoiceId })
    .from(creditNotes)
    .where(and(eq(creditNotes.id, id), eq(creditNotes.userId, session.userId)))
    .limit(1);
  if (!note || !(await deleteLatestCreditNote(getDb(), id, session.userId))) {
    return { errorKey: "notLatest" };
  }

  refresh(note.invoiceId);
  return { ok: true };
}

import { sql } from "drizzle-orm";
import type { getDb, NewInvoice } from "@/lib/db";

type Db = ReturnType<typeof getDb>;

export type DraftLineItem = { description: string; quantity: number; unitPrice: number };

export type DraftValues = Pick<
  NewInvoice,
  | "clientId"
  | "date"
  | "supplyDate"
  | "dueDate"
  | "currency"
  | "exchangeRateMKD"
  | "subtotal"
  | "ddvRate"
  | "ddvAmount"
  | "total"
  | "totalMKD"
  | "notes"
>;

// Saves changes to a draft and replaces its line items, in one statement:
// the update only matches while the row is still one of the user's drafts,
// and the items are only replaced for a row the update matched. An issued
// invoice is locked, and issuing a draft while it's being saved can't let
// half of the edit through. Returns false when nothing was saved (not a
// draft, or not the user's).
export async function updateDraftInvoice(
  db: Db,
  invoiceId: string,
  userId: string,
  values: DraftValues,
  items: readonly DraftLineItem[],
  newItemId: () => string
): Promise<boolean> {
  const rows = sql.join(
    items.map(
      (item) =>
        sql`(${newItemId()}, ${item.description}, ${item.quantity}::double precision, ${item.unitPrice}::double precision, ${item.quantity * item.unitPrice}::double precision)`
    ),
    sql`, `
  );
  const result = await db.execute<{ id: string }>(sql`
    with target as (
      update invoices set
        client_id = ${values.clientId},
        date = ${values.date},
        supply_date = ${values.supplyDate ?? values.date},
        due_date = ${values.dueDate ?? null},
        currency = ${values.currency},
        exchange_rate_mkd = ${values.exchangeRateMKD}::double precision,
        subtotal = ${values.subtotal}::double precision,
        ddv_rate = ${values.ddvRate}::double precision,
        ddv_amount = ${values.ddvAmount}::double precision,
        total = ${values.total}::double precision,
        total_mkd = ${values.totalMKD}::double precision,
        notes = ${values.notes ?? null}
      where id = ${invoiceId} and user_id = ${userId} and status = 'draft'
      returning id
    ), removed as (
      delete from invoice_items where invoice_id in (select id from target)
    ), added as (
      insert into invoice_items (id, invoice_id, description, quantity, unit_price, total)
      select item.id, target.id, item.description, item.quantity, item.unit_price, item.total
      from target, (values ${rows}) as item (id, description, quantity, unit_price, total)
    )
    select id from target
  `);
  return result.rows.length > 0;
}

import { sql } from "drizzle-orm";
import type { getDb } from "@/lib/db";

type Db = ReturnType<typeof getDb>;

// Invoice numbers are INV-YYYY-NNN: the year of the invoice date, then one
// more than the user's highest number for that year, at least three digits
// (INV-2026-001 ... INV-2026-999, INV-2026-1000). A draft has no number; it
// gets one when it's issued, so numbers run without gaps from deleted drafts.
// Numbers that don't follow the pattern are left alone and don't count.

// Postgres unique_violation. Drizzle wraps the driver error, so the code can
// be on error.cause.
function isUniqueViolation(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : undefined;
  return [error, cause].some(
    (e) => typeof e === "object" && e !== null && "code" in e && e.code === "23505"
  );
}

// Issues a draft: status "sent" and, unless it already has one (drafts from
// before numbering moved to issue time), the next number for its year. The
// number is worked out and stored in one UPDATE, so nothing can take it in
// between; if two issues for the same user and year still race, the unique
// index on (user_id, number) rejects the second, which then tries again with
// the next number. Returns the number, or null when the invoice isn't one
// of the user's drafts (already issued, or not theirs).
export async function issueDraftInvoice(
  db: Db,
  invoiceId: string,
  userId: string
): Promise<string | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await db.execute<{ number: string }>(sql`
        update invoices as target
        set status = 'sent',
            number = coalesce(target.number, (
              select 'INV-' || substr(target.date, 1, 4) || '-'
                || lpad(next.n::text, greatest(3, length(next.n::text)), '0')
              from (
                select coalesce(
                  max(substring(other.number from '^INV-[0-9]{4}-([0-9]+)$')::bigint), 0
                ) + 1 as n
                from invoices as other
                where other.user_id = target.user_id
                  and other.number like 'INV-' || substr(target.date, 1, 4) || '-%'
              ) as next
            ))
        where target.id = ${invoiceId}
          and target.user_id = ${userId}
          and target.status = 'draft'
        returning target.number as number
      `);
      return result.rows[0]?.number ?? null;
    } catch (error) {
      if (attempt < 3 && isUniqueViolation(error)) continue;
      throw error;
    }
  }
}

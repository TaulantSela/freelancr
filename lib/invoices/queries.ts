import { getDb, invoices, invoiceItems, clients, users } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { resolveBankDetails, type BankDetails } from "@/lib/profile";

export type InvoiceDetail = {
  invoice: {
    id: string;
    // Null while the invoice is a draft.
    number: string | null;
    date: string;
    // The date of supply; the invoice date for rows saved without one.
    supplyDate: string;
    dueDate: string | null;
    currency: string;
    exchangeRateMKD: number;
    subtotal: number;
    ddvRate: number;
    ddvAmount: number;
    total: number;
    totalMKD: number;
    status: string;
    notes: string | null;
    paidAt: string | null;
  };
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  client: {
    name: string;
    clientType: string;
    email: string | null;
    taxId: string | null;
    country: string;
    invoiceLanguage: string | null;
    address: string | null;
    contactPerson: string | null;
  };
  user: {
    name: string;
    businessName: string | null;
    taxNumber: string | null;
    vatRegistered: boolean;
    vatNumber: string | null;
    address: string | null;
    placeOfIssue: string | null;
    // Who signs the invoice: the signatory from Settings, or the user.
    signatory: string;
    bank: BankDetails;
  };
};

export async function getInvoiceDetail(
  id: string,
  userId: string
): Promise<InvoiceDetail | null> {
  const db = getDb();

  const [row] = await db
    .select({
      invoice: invoices,
      client: clients,
      user: users,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .innerJoin(users, eq(invoices.userId, users.id))
    .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
    .limit(1);

  if (!row) return null;

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, id));

  return {
    invoice: {
      id: row.invoice.id,
      number: row.invoice.number,
      date: row.invoice.date,
      supplyDate: row.invoice.supplyDate ?? row.invoice.date,
      dueDate: row.invoice.dueDate,
      currency: row.invoice.currency,
      exchangeRateMKD: row.invoice.exchangeRateMKD,
      subtotal: row.invoice.subtotal,
      ddvRate: row.invoice.ddvRate,
      ddvAmount: row.invoice.ddvAmount,
      total: row.invoice.total,
      totalMKD: row.invoice.totalMKD,
      status: row.invoice.status,
      notes: row.invoice.notes,
      paidAt: row.invoice.paidAt,
    },
    items: items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    })),
    client: {
      name: row.client.name,
      clientType: row.client.clientType,
      email: row.client.email,
      taxId: row.client.taxId,
      country: row.client.country,
      invoiceLanguage: row.client.invoiceLanguage,
      address: row.client.address,
      contactPerson: row.client.contactPerson,
    },
    user: {
      name: row.user.name,
      businessName: row.user.businessName,
      taxNumber: row.user.taxNumber,
      vatRegistered: row.user.vatRegistered,
      vatNumber: row.user.vatNumber,
      address: row.user.address,
      placeOfIssue: row.user.placeOfIssue,
      signatory: row.user.signatoryName || row.user.name,
      bank: resolveBankDetails(row.user),
    },
  };
}

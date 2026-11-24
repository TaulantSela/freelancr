// The sample data. The shared demo account (scripts/seed-demo.ts) and each
// visitor's sandbox (lib/demo/sandbox.ts) get the same business, clients,
// invoices, payments, credit note and UJP steps, dated from today: the last
// six months, the older ones filed and paid with UJP, this month (and last
// month, until its deadlines pass) still open.

import { nanoid } from "nanoid";
import { clients, invoices, invoiceItems, type getDb } from "@/lib/db";
import { getRateToMKD } from "@/lib/tax/calculator";
import { getRatesFor } from "@/lib/rates/queries";
import { insertInvoicePayment, insertPayout, markMonth } from "@/lib/payments/write";
import { taxTreatmentFor } from "@/lib/payments/config";
import { insertCreditNote } from "@/lib/credit-notes/write";

type Db = ReturnType<typeof getDb>;

// The user row's profile: not registered for an activity (the default tax
// status), so clients abroad and private persons are self-reported and
// companies in North Macedonia withhold the tax; not registered for VAT.
export const SAMPLE_PROFILE = {
  name: "Aleksandar Jovanov",
  businessName: "AJ Studio",
  taxNumber: "4012345678901",
  address: "Ul. Makedonija 12, Skopje 1000",
  placeOfIssue: "Skopje",
  bankName: "Komercijalna Banka AD",
  iban: "MK07 2501 2000 0058 984",
  bic: "KOBSMK2X",
  taxStatus: "paid_from_abroad",
} as const;

// "YYYY-MM-DD" for day `day` of the month `n` months before today's; a day
// later in this month than today is today (nothing in the future).
export function monthsAgo(today: string, n: number, day: number): string {
  const [y, m] = today.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - n, 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
  return date > today ? today : date;
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const CLIENTS = [
  { key: "acme", name: "Acme GmbH", email: "billing@acme.de", taxId: "DE123456789", country: "DE", currency: "EUR", contactPerson: "Klaus Weber" },
  { key: "labs", name: "Startup Labs NYC", email: "finance@startuplabs.io", taxId: "US-EIN-12-3456789", country: "US", currency: "USD", contactPerson: "Sarah Chen" },
  { key: "wave", name: "DigitalWave SRL", email: "accounts@digitalwave.nl", taxId: "NL987654321B01", country: "NL", currency: "EUR", contactPerson: "Pieter van Dam" },
  { key: "vardar", name: "Vardar Print DOOEL", email: "smetkovodstvo@vardarprint.mk", taxId: "4030012345678", country: "MK", currency: "MKD", contactPerson: "Elena Trajkovska" },
  // Withholds 5% on payments abroad: the user credits it against the 10%.
  { key: "belgrade", name: "Belgrade Soft d.o.o.", email: "racuni@belgradesoft.rs", taxId: "RS101234567", country: "RS", currency: "EUR", contactPerson: "Milan Petrović" },
  // A platform: payouts without an invoice.
  { key: "upwork", name: "Upwork", email: null, taxId: null, country: "US", currency: "USD", contactPerson: null },
] as const;
type ClientKey = (typeof CLIENTS)[number]["key"];

const ITEM_SETS = [
  ["Web development services", "Design & frontend implementation", "Backend API integration"],
  ["QA testing & automation", "Bug fixes & regression testing"],
  ["UI/UX design", "Figma prototyping", "Design system components"],
];

// The National Bank's middle rates for the sample's days (the cache first,
// then one request for what's missing), or the app's fixed rates, marked as
// such, for any day the service can't give in time.
async function sampleRates(days: { date: string; currency: string }[], timeoutMs: number) {
  const nbrsm = await getRatesFor(days, { timeoutMs });
  return (currency: string, date: string) => {
    if (currency === "MKD") return { rate: 1, exact: true };
    const rate = nbrsm.get(`${date}:${currency}`);
    return rate ? { rate, exact: true } : { rate: getRateToMKD(currency), exact: false };
  };
}

// Writes the sample clients, invoices, payments, credit note and UJP steps
// into the user's account. Returns how many amounts fell back on the fixed
// rates (0 when the National Bank's covered them all).
export async function insertSampleData(
  db: Db,
  userId: string,
  today: string,
  { rateTimeoutMs = 5000 }: { rateTimeoutMs?: number } = {}
): Promise<{ approximateRates: number }> {
  const taxStatus = SAMPLE_PROFILE.taxStatus;
  const clientOf = (key: ClientKey) => CLIENTS.find((c) => c.key === key)!;

  // Issued invoices are numbered in date order; a draft has no number.
  const invoiceRecords: { key: string; client: ClientKey; date: string; subtotal: number; draft?: boolean }[] = [
    { key: "i1", client: "acme", date: monthsAgo(today, 5, 5), subtotal: 2400 },
    { key: "i2", client: "labs", date: monthsAgo(today, 4, 1), subtotal: 1800 },
    { key: "i3", client: "acme", date: monthsAgo(today, 3, 3), subtotal: 3200 },
    { key: "i4", client: "vardar", date: monthsAgo(today, 3, 10), subtotal: 120000 },
    { key: "i5", client: "belgrade", date: monthsAgo(today, 2, 4), subtotal: 2000 },
    { key: "i6", client: "labs", date: monthsAgo(today, 2, 20), subtotal: 1500 },
    { key: "i7", client: "wave", date: monthsAgo(today, 1, 25), subtotal: 1600 },
    { key: "i8", client: "acme", date: monthsAgo(today, 0, 2), subtotal: 2000 },
    { key: "draft", client: "acme", date: today, subtotal: 2600, draft: true },
  ];

  // Payments, written the way the app writes them: each invoice payment
  // brings its invoice's status in step (paid once covered).
  const paymentRecords: {
    client: ClientKey;
    invoice?: string;
    receivedOn: string;
    amount: number;
    fees?: number;
    taxWithheld?: number;
    channel: string;
    note?: string;
  }[] = [
    { client: "acme", invoice: "i1", receivedOn: monthsAgo(today, 5, 20), amount: 2400, channel: "bank" },
    // The bank took 25 USD on the way: it still settles the invoice.
    { client: "labs", invoice: "i2", receivedOn: monthsAgo(today, 4, 12), amount: 1775, fees: 25, channel: "bank" },
    // Paid in two parts.
    { client: "acme", invoice: "i3", receivedOn: monthsAgo(today, 3, 20), amount: 1600, channel: "bank", note: "First half" },
    { client: "acme", invoice: "i3", receivedOn: monthsAgo(today, 2, 8), amount: 1600, channel: "bank", note: "Second half" },
    // A company in North Macedonia pays 90% and withholds 10% (Art. 80).
    { client: "vardar", invoice: "i4", receivedOn: monthsAgo(today, 2, 2), amount: 108000, taxWithheld: 12000, channel: "bank" },
    // 5% withheld in Serbia, with the certificate: credited against the 10%.
    { client: "belgrade", invoice: "i5", receivedOn: monthsAgo(today, 1, 6), amount: 1900, taxWithheld: 100, channel: "bank", note: "Certificate of tax paid received" },
    // Platform payouts, without an invoice.
    { client: "upwork", receivedOn: monthsAgo(today, 1, 14), amount: 830, fees: 2, channel: "platform" },
    { client: "upwork", receivedOn: monthsAgo(today, 0, 3), amount: 640, fees: 2, channel: "platform" },
    // Partly paid this month.
    { client: "wave", invoice: "i7", receivedOn: monthsAgo(today, 0, 10), amount: 800, channel: "wise" },
  ];

  const rateOn = await sampleRates(
    [
      ...invoiceRecords.map((i) => ({ date: i.date, currency: clientOf(i.client).currency })),
      ...paymentRecords.map((p) => ({ date: p.receivedOn, currency: clientOf(p.client).currency })),
    ],
    rateTimeoutMs
  );
  let approximateRates = 0;

  const clientIds = Object.fromEntries(CLIENTS.map((c) => [c.key, nanoid()])) as Record<ClientKey, string>;
  await db.insert(clients).values(
    CLIENTS.map((c) => ({
      id: clientIds[c.key],
      userId,
      name: c.name,
      email: c.email,
      taxId: c.taxId,
      clientType: "company" as const,
      country: c.country,
      currency: c.currency,
      invoiceLanguage: c.country === "MK" ? ("mk" as const) : ("en" as const),
      contactPerson: c.contactPerson,
    }))
  );

  const invoiceIds: Record<string, string> = {};
  const counters: Record<string, number> = {};
  const invoiceRows = [];
  const itemRows = [];
  for (let i = 0; i < invoiceRecords.length; i++) {
    const inv = invoiceRecords[i];
    const client = clientOf(inv.client);
    const id = nanoid();
    const year = inv.date.slice(0, 4);
    const number = inv.draft
      ? null
      : `INV-${year}-${String((counters[year] = (counters[year] ?? 0) + 1)).padStart(3, "0")}`;
    // The VAT law's rate: the National Bank's on the date of supply.
    const { rate, exact } = rateOn(client.currency, inv.date);
    if (!exact) approximateRates++;
    invoiceRows.push({
      id,
      userId,
      clientId: clientIds[inv.client],
      number,
      date: inv.date,
      supplyDate: inv.date,
      dueDate: addDays(inv.date, 30),
      currency: client.currency,
      exchangeRateMKD: rate,
      rateSource: exact ? ("nbrsm" as const) : ("approximate" as const),
      rateDate: exact ? inv.date : null,
      subtotal: inv.subtotal,
      ddvRate: 0,
      ddvAmount: 0,
      total: inv.subtotal,
      totalMKD: Math.round(inv.subtotal * rate * 100) / 100,
      status: inv.draft ? ("draft" as const) : ("sent" as const),
    });
    invoiceIds[inv.key] = id;
    const items = ITEM_SETS[i % ITEM_SETS.length];
    const perItem = inv.subtotal / items.length;
    for (const description of items) {
      itemRows.push({ id: nanoid(), invoiceId: id, description, quantity: 1, unitPrice: perItem, total: perItem });
    }
  }
  await db.insert(invoices).values(invoiceRows);
  await db.insert(invoiceItems).values(itemRows);

  for (const p of paymentRecords) {
    const client = clientOf(p.client);
    const taxTreatment = taxTreatmentFor(taxStatus, { country: client.country, clientType: "company" });
    const { rate, exact } = rateOn(client.currency, p.receivedOn);
    if (!exact) approximateRates++;
    const fields = {
      id: nanoid(),
      userId,
      taxTreatment,
      ujpStatus: taxTreatment === "self_reported" ? ("to_file" as const) : null,
      receivedOn: p.receivedOn,
      currency: client.currency,
      amount: p.amount,
      fees: p.fees ?? 0,
      taxWithheld: p.taxWithheld ?? 0,
      rateToMKD: rate,
      rateSource: exact ? ("nbrsm" as const) : ("manual" as const),
      deemedCostsRate: 0,
      channel: p.channel,
      note: p.note ?? null,
    };
    const saved = p.invoice
      ? await insertInvoicePayment(db, { ...fields, invoiceId: invoiceIds[p.invoice] })
      : await insertPayout(db, { ...fields, clientId: clientIds[p.client] });
    if (!saved) throw new Error(`Payment from ${client.name} on ${p.receivedOn} wasn't saved`);
  }

  // A credit note: a discount agreed on the overdue invoice.
  const creditNote = await insertCreditNote(db, {
    id: nanoid(),
    userId,
    invoiceId: invoiceIds.i6,
    date: monthsAgo(today, 0, 5),
    amount: 300,
    reason: "Discount agreed for the late delivery of the second milestone",
  });
  if (!creditNote) throw new Error("The sample credit note wasn't saved");

  // UJP: months before last month are filed, approved and paid. Last month
  // follows today: still to file until the 10th, filed and approved until
  // the 15th, paid after that. This month is open.
  const day = Number(today.slice(8, 10));
  for (let n = 5; n >= 1; n--) {
    const month = monthsAgo(today, n, 1).slice(0, 7);
    const [y, m] = month.split("-").map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    if (n === 1 && day <= 10) continue;
    // Made-up sample numbers.
    await markMonth(db, userId, month, { to: "filed", reference: `DEMO-${month}` });
    await markMonth(db, userId, month, { to: "approved", folio: `F-${month}` });
    if (n === 1 && day <= 15) continue;
    await markMonth(db, userId, month, { to: "paid", paidOn: `${next}-14` });
  }
  return { approximateRates };
}

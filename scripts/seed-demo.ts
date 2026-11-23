import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { getDb, users, clients, invoices, invoiceItems } from "../lib/db";
import { getRateToMKD, toSkopjeDate } from "../lib/tax/calculator";
import { fetchNbrsmRates } from "../lib/rates/nbrsm";
import { insertInvoicePayment, insertPayout, markMonth } from "../lib/payments/write";
import { taxTreatmentFor } from "../lib/payments/config";

const DEMO_EMAIL = "demo@freelancr.mk";
const DEMO_PASSWORD = "demo1234";

// The demo's dates follow today, so its months line up with the calendar:
// the last six months, the older ones filed and paid with UJP, this month
// (and last month, until its deadlines pass) still open.
function monthsAgo(today: string, n: number, day: number): string {
  const [y, m] = today.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - n, 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
  // Nothing in the future: a day later in this month than today is today.
  return date > today ? today : date;
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

async function main() {
  const db = getDb();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEMO_EMAIL))
    .limit(1);

  if (existing) {
    console.log(`Demo account already exists (${DEMO_EMAIL}) — skipping seed.`);
    process.exit(0);
  }

  const today = toSkopjeDate(new Date());
  const from = monthsAgo(today, 6, 1);

  // The National Bank's middle rates for the whole period in one request.
  // If the service can't be reached, the demo uses the app's fixed rates and
  // marks them: 'manual' on payments, 'approximate' on invoices.
  // Today's list may not be out yet: then up to yesterday.
  const fetched =
    (await fetchNbrsmRates(from, today)) ?? (await fetchNbrsmRates(from, addDays(today, -1)));
  const nbrsm = new Map((fetched ?? []).map((r) => [`${r.date}:${r.code}`, r.rate]));
  function rateOn(currency: string, date: string) {
    if (currency === "MKD") return { rate: 1, exact: true };
    const rate = nbrsm.get(`${date}:${currency}`);
    return rate ? { rate, exact: true } : { rate: getRateToMKD(currency), exact: false };
  }
  console.log(fetched ? "Using the National Bank's rates." : "National Bank unreachable: using the fixed rates.");

  const userId = nanoid();
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 12);

  // Not registered for an activity (the default tax status): clients abroad
  // and private persons are self-reported, companies in North Macedonia
  // withhold the tax.
  await db.insert(users).values({
    id: userId,
    email: DEMO_EMAIL,
    passwordHash,
    name: "Aleksandar Jovanov",
    businessName: "AJ Studio",
    taxNumber: "4012345678901",
    address: "Ul. Makedonija 12, Skopje 1000",
    placeOfIssue: "Skopje",
    bankName: "Komercijalna Banka AD",
    iban: "MK07 2501 2000 0058 984",
    bic: "KOBSMK2X",
  });
  const taxStatus = "paid_from_abroad";

  const clientRecords = [
    { key: "acme", name: "Acme GmbH", email: "billing@acme.de", taxId: "DE123456789", country: "DE", currency: "EUR", contactPerson: "Klaus Weber" },
    { key: "labs", name: "Startup Labs NYC", email: "finance@startuplabs.io", taxId: "US-EIN-12-3456789", country: "US", currency: "USD", contactPerson: "Sarah Chen" },
    { key: "wave", name: "DigitalWave SRL", email: "accounts@digitalwave.nl", taxId: "NL987654321B01", country: "NL", currency: "EUR", contactPerson: "Pieter van Dam" },
    { key: "vardar", name: "Vardar Print DOOEL", email: "smetkovodstvo@vardarprint.mk", taxId: "4030012345678", country: "MK", currency: "MKD", contactPerson: "Elena Trajkovska" },
    // Withholds 5% on payments abroad: the user credits it against the 10%.
    { key: "belgrade", name: "Belgrade Soft d.o.o.", email: "racuni@belgradesoft.rs", taxId: "RS101234567", country: "RS", currency: "EUR", contactPerson: "Milan Petrović" },
    // A platform: payouts without an invoice.
    { key: "upwork", name: "Upwork", email: null, taxId: null, country: "US", currency: "USD", contactPerson: null },
  ];

  const clientIds: Record<string, string> = {};
  for (const c of clientRecords) {
    const id = nanoid();
    await db.insert(clients).values({
      id,
      userId,
      name: c.name,
      email: c.email,
      taxId: c.taxId,
      clientType: "company",
      country: c.country,
      currency: c.currency,
      invoiceLanguage: c.country === "MK" ? "mk" : "en",
      contactPerson: c.contactPerson,
    });
    clientIds[c.key] = id;
  }
  const clientOf = (key: string) => clientRecords.find((c) => c.key === key)!;

  const itemSets = [
    ["Web development services", "Design & frontend implementation", "Backend API integration"],
    ["QA testing & automation", "Bug fixes & regression testing"],
    ["UI/UX design", "Figma prototyping", "Design system components"],
  ];

  // Issued invoices are numbered in date order; a draft has no number.
  const invoiceRecords = [
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

  const invoiceIds: Record<string, string> = {};
  const counters: Record<string, number> = {};
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

    await db.insert(invoices).values({
      id,
      userId,
      clientId: clientIds[inv.client],
      number,
      date: inv.date,
      supplyDate: inv.date,
      dueDate: addDays(inv.date, 30),
      currency: client.currency,
      exchangeRateMKD: rate,
      rateSource: exact ? "nbrsm" : "approximate",
      rateDate: exact ? inv.date : null,
      subtotal: inv.subtotal,
      ddvRate: 0,
      ddvAmount: 0,
      total: inv.subtotal,
      totalMKD: Math.round(inv.subtotal * rate * 100) / 100,
      status: inv.draft ? "draft" : "sent",
    });
    invoiceIds[inv.key] = id;

    const items = itemSets[i % itemSets.length];
    const perItem = inv.subtotal / items.length;
    for (const desc of items) {
      await db.insert(invoiceItems).values({
        id: nanoid(),
        invoiceId: id,
        description: desc,
        quantity: 1,
        unitPrice: perItem,
        total: perItem,
      });
    }
  }

  // Payments, written the way the app writes them: each invoice payment
  // brings its invoice's status in step (paid once covered).
  const paymentRecords: {
    client: string;
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

  for (const p of paymentRecords) {
    const client = clientOf(p.client);
    const taxTreatment = taxTreatmentFor(taxStatus, { country: client.country, clientType: "company" });
    const { rate, exact } = rateOn(client.currency, p.receivedOn);
    const fields = {
      id: nanoid(),
      userId,
      taxTreatment,
      ujpStatus: taxTreatment === "self_reported" ? "to_file" : null,
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

  // UJP: months before last month are filed, approved and paid. Last month
  // follows today: still to file until the 10th, filed and approved until
  // the 15th, paid after that. This month is open.
  const day = Number(today.slice(8, 10));
  for (let n = 5; n >= 1; n--) {
    const month = monthsAgo(today, n, 1).slice(0, 7);
    const [y, m] = month.split("-").map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    if (n === 1 && day <= 10) continue;
    // Made-up demo numbers.
    await markMonth(db, userId, month, { to: "filed", reference: `DEMO-${month}` });
    await markMonth(db, userId, month, { to: "approved", folio: `F-${month}` });
    if (n === 1 && day <= 15) continue;
    await markMonth(db, userId, month, { to: "paid", paidOn: `${next}-14` });
  }

  console.log("✓ Demo account seeded");
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

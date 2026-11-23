import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { getDb, users, clients, invoices, invoiceItems } from "../lib/db";

const DEMO_EMAIL = "demo@freelancr.mk";
const DEMO_PASSWORD = "demo1234";

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

const userId = nanoid();
const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 12);

await db.insert(users).values({
  id: userId,
  email: DEMO_EMAIL,
  passwordHash,
  name: "Aleksandar Jovanov",
  businessName: "AJ Studio",
  taxNumber: "4012345678901",
  address: "Ul. Makedonija 12, Skopje 1000",
  bankAccount: "MK07 3000 0001 2345 678",
  bankName: "Komercijalna Banka AD",
});

const clientRecords = [
  {
    id: nanoid(),
    name: "Acme GmbH",
    email: "billing@acme.de",
    taxId: "DE123456789",
    country: "DE",
    currency: "EUR",
    contactPerson: "Klaus Weber",
  },
  {
    id: nanoid(),
    name: "Startup Labs NYC",
    email: "finance@startuplabs.io",
    taxId: "US-EIN-12-3456789",
    country: "US",
    currency: "USD",
    contactPerson: "Sarah Chen",
  },
  {
    id: nanoid(),
    name: "DigitalWave SRL",
    email: "accounts@digitalwave.nl",
    taxId: "NL987654321B01",
    country: "NL",
    currency: "EUR",
    contactPerson: "Pieter van Dam",
  },
];

const clientIds: string[] = [];
for (const c of clientRecords) {
  await db.insert(clients).values({
    id: c.id,
    userId,
    name: c.name,
    email: c.email,
    taxId: c.taxId,
    country: c.country,
    currency: c.currency,
    contactPerson: c.contactPerson,
  });
  clientIds.push(c.id);
}

const invoiceRecords = [
  { clientIdx: 0, number: "INV-2026-001", date: "2026-01-15", currency: "EUR", rate: 61.5, subtotal: 2400, status: "paid", paidAt: "2026-01-22" },
  { clientIdx: 1, number: "INV-2026-002", date: "2026-02-01", currency: "USD", rate: 56.8, subtotal: 1800, status: "paid", paidAt: "2026-02-10" },
  { clientIdx: 0, number: "INV-2026-003", date: "2026-02-15", currency: "EUR", rate: 61.5, subtotal: 3200, status: "paid", paidAt: "2026-03-01" },
  { clientIdx: 2, number: "INV-2026-004", date: "2026-03-05", currency: "EUR", rate: 61.5, subtotal: 1600, status: "paid", paidAt: "2026-03-18" },
  { clientIdx: 0, number: "INV-2026-005", date: "2026-04-01", currency: "EUR", rate: 61.5, subtotal: 2800, status: "paid", paidAt: "2026-04-14" },
  { clientIdx: 1, number: "INV-2026-006", date: "2026-04-20", currency: "USD", rate: 56.8, subtotal: 2200, status: "paid", paidAt: "2026-05-02" },
  { clientIdx: 2, number: "INV-2026-007", date: "2026-05-05", currency: "EUR", rate: 61.5, subtotal: 3500, status: "sent" },
  { clientIdx: 0, number: "INV-2026-008", date: "2026-05-18", currency: "EUR", rate: 61.5, subtotal: 2600, status: "draft" },
];

const itemSets = [
  ["Web development services", "Design & frontend implementation", "Backend API integration"],
  ["QA testing & automation", "Bug fixes & regression testing"],
  ["UI/UX design", "Figma prototyping", "Design system components"],
];

for (let i = 0; i < invoiceRecords.length; i++) {
  const inv = invoiceRecords[i];
  const invoiceId = nanoid();
  const total = inv.subtotal;
  const totalMKD = total * inv.rate;
  const dueDate = new Date(new Date(inv.date).getTime() + 30 * 86400000)
    .toISOString()
    .split("T")[0];

  await db.insert(invoices).values({
    id: invoiceId,
    userId,
    clientId: clientIds[inv.clientIdx],
    number: inv.number,
    date: inv.date,
    dueDate,
    currency: inv.currency,
    exchangeRateMKD: inv.rate,
    subtotal: inv.subtotal,
    ddvRate: 0,
    ddvAmount: 0,
    total,
    totalMKD,
    status: inv.status,
    paidAt: inv.paidAt ?? null,
  });

  const items = itemSets[i % itemSets.length];
  const perItem = inv.subtotal / items.length;
  for (const desc of items) {
    await db.insert(invoiceItems).values({
      id: nanoid(),
      invoiceId,
      description: desc,
      quantity: 1,
      unitPrice: perItem,
      total: perItem,
    });
  }
}

  console.log("✓ Demo account seeded");
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

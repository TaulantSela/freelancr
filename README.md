# 🧾💶 Freelancr

<img src="public/logo.svg" alt="Freelancr logo" width="88" align="right">

Invoicing and tax tracking for freelancers in North Macedonia who aren't
registered for VAT (DDV) yet. You invoice foreign and local clients in their
currency, and Freelancr keeps a running MKD total against the 2,000,000 MKD DDV
threshold, estimates your income tax, and shows the next quarterly deadline.
It's an early MVP, in Macedonian, Albanian and English.

**▶ [Try it live →](https://freelancr-mk.vercel.app)** — sign up with an email
and password.

If you invoice in Word and track income in a spreadsheet, you're doing the DDV
and tax math by hand, and general-purpose invoicing tools don't know what DDV
is. Freelancr puts the invoices and the local tax picture in one place.

## Features

| Area | What's there |
|------|--------------|
| Invoices | Line items, optional DDV (0%, 5% or 18%), numbering per year (`INV-2026-001`), and an MKD equivalent at an approximate rate |
| Currencies | EUR, USD, GBP, CHF, AUD and MKD; each client has a default currency |
| Status | Draft, sent, paid, overdue or cancelled, set from the invoice list or detail page |
| PDF | Download any invoice as a PDF in the language you're using |
| Clients | Create and edit, with tax ID, country, contact person and notes; delete clients that have no invoices |
| Dashboard | Paid income this year, outstanding invoices, estimated tax, the DDV monitor, the next tax deadline and recent invoices |
| DDV monitor | Progress toward 2,000,000 MKD of paid income this year, with warnings at 70%, 85% and 100% |
| Income page | Monthly breakdown, income by client and by currency, an income tax estimate and the quarterly deadlines (Apr 30, Jul 31, Oct 31, Jan 31) |
| Settings | Business profile (EDB, address, bank account) and an e-Faktura readiness checklist based on how complete it is |
| Languages | Macedonian (default), Albanian and English |

## Known limitations

- **Exchange rates are hardcoded.** Invoices use fixed rates from
  `lib/tax/calculator.ts` (EUR 61.5, USD 56.8, GBP 72.1), labelled as
  approximate. Currencies without a rate (CHF, AUD, and CAD, which a client can
  default to) count 1:1 toward the MKD totals. `/api/exchange-rate` can fetch a
  live rate, but nothing calls it yet, and the `exchange_rate_cache` table is
  unused.
- **Nothing is emailed.** There's no email sending at all. "Sent" and
  "overdue" are labels you set by hand (overdue isn't detected), and tax
  deadlines show up in the app only.
- **Invoices can't be edited** after you create them; you can change the
  status or delete the invoice.
- **Tax rules are constants.** The DDV threshold, income tax brackets and
  deadlines are hardcoded in `lib/tax/calculator.ts`. Treat the numbers as
  estimates, not tax advice.
- **No e-Faktura integration.** The readiness checklist only checks your
  profile; nothing talks to UJP.
- **No billing.** Every account is on the free plan. The landing page lists
  paid plans and features that aren't built yet (Wise and PayPal CSV import,
  contract templates, accountant sharing).
- **No password reset.**

## How it works

1. **Next.js 16 App Router.** Pages in `app/(dashboard)` are server components
   that query the database directly; writes go through Server Actions in
   `lib/actions/` (auth, clients, invoices, settings, locale).
2. **Auth.** Email and password with bcrypt hashes. The session is a JWT signed
   with `jose` in an httpOnly cookie that lasts 30 days, and `proxy.ts` sends
   signed-out visitors to `/sign-in`.
3. **Data.** Drizzle ORM on Neon Postgres over Neon's serverless HTTP driver.
   Tables: users, clients, invoices, invoice items. Each invoice stores its
   rate and MKD total when it's created.
4. **Tax logic.** `lib/tax/calculator.ts` holds the constants and the DDV,
   income tax and deadline calculations used by the dashboard and income page.
5. **PDFs.** `GET /api/invoices/[id]/pdf` renders the invoice with
   `@react-pdf/renderer`, using Noto Sans for Cyrillic.
6. **i18n.** Typed dictionaries in `lib/i18n/dictionaries/` (`mk`, `en`,
   `sq`); the chosen language is kept in a cookie.

Stack: Next.js 16 · TypeScript · Drizzle ORM · Neon Postgres · `jose` JWT
sessions · Tailwind CSS 4 with shadcn/ui on Base UI · `@react-pdf/renderer`.

## Run locally

Requires Node.js 20.6+ (the database scripts use `--env-file`) and a Neon
Postgres database.

```bash
npm install
cp .env.example .env.local   # set DATABASE_URL and SESSION_SECRET
npm run setup                # migrations + demo data
npm run dev
```

If the project is linked to Vercel, `vercel env pull .env.local` fills in
`DATABASE_URL` instead. `SESSION_SECRET` is required in production; generate
one with `openssl rand -base64 32`.

After `npm run setup` you can sign in with the demo account,
`demo@freelancr.mk` / `demo1234`, which comes with sample clients and invoices.

| Script | What it does |
|--------|--------------|
| `npm run db:migrate` | Apply the Drizzle migrations in `drizzle/` |
| `npm run db:seed` | Create the demo user with sample clients and invoices |
| `npm run setup` | Both of the above |
| `npm run db:generate` | Generate a migration from `lib/db/schema.ts` |
| `npm run lint` | ESLint |

## Deploy

```bash
vercel integration add neon                # provisions DATABASE_URL
vercel env add SESSION_SECRET production
vercel deploy --prod
```

On Vercel the `vercel-build` script runs the migrations before `next build`.

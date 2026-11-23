# 🧾💶 Freelancr

<img src="public/logo.svg" alt="Freelancr logo" width="88" align="right">

Invoicing and tax tracking for freelancers in North Macedonia: clients at
home and abroad, numbered invoices in each client's language, and what you owe
UJP. Freelancr shows your UJP deadlines with an approximate amount for each,
and, until you're registered for VAT (DDV), how close your supplies in North
Macedonia are to the 2,000,000 MKD registration threshold.
It's an early MVP, in Macedonian, Albanian and English.

**▶ [Try it live →](https://freelancr-mk.vercel.app)** — sign up with an email
and password.

If you invoice in Word and track income in a spreadsheet, you're doing the DDV
and tax math by hand, and general-purpose invoicing tools don't know what DDV
is. Freelancr puts the invoices and the local tax picture in one place.

## Features

| Area | What's there |
|------|--------------|
| Invoices | Line items, a date of supply, and an MKD equivalent at an approximate rate. A new invoice is a draft without a number; you can edit it, delete it or issue it. Issuing gives it the next number for its year (`INV-2026-001`) and locks it; an issued invoice can be cancelled (it's kept) but not deleted |
| VAT (DDV) | Only a user registered for VAT gets the DDV rate choice (0%, 5% or 18%); everyone else's invoices carry none, whatever the form sends (VAT law Art. 51(3), Art. 55) |
| Currencies | EUR, USD, GBP, CHF, AUD, CAD and MKD, from one shared list; each client has a default currency |
| Status | Draft, then Issued, Paid or Overdue from the status menu, or Cancelled |
| PDF | In the client's invoice language, with what an invoice has to state: number, date and place of issue, date of supply, the issuer's VAT number or "The issuer is not registered for VAT.", the signatory with a line to sign, and bank, IBAN and BIC/SWIFT |
| Clients | Company or private person, any country (ISO 3166 plus Kosovo), invoice language (Macedonian by default for clients in North Macedonia, English otherwise), tax ID, contact person and notes; a client with invoices can't be deleted, and the app says why |
| Dashboard | What you owe UJP next, paid income this year, outstanding invoices, the DDV monitor, the next tax deadline and recent invoices |
| Owed to UJP | Not registered for an activity: 10% of each month's self-reported income, due by the 15th of the next month, with the calculation by the 10th. It's approximate (each invoice's stored rate, gross amount) and says so. Registered self-employed: the monthly advance you enter in Settings |
| DDV monitor | Your issued invoices to clients in North Macedonia this year, paid or not, by date of supply, against 2,000,000 MKD, with warnings at 70%, 85% and over the threshold. Services to clients abroad don't count; hidden once you're registered for VAT or while there's no local supply |
| Income page | Monthly breakdown, income by client, and the year's tax deadlines with each month's amount owed |
| Tax deadlines | UJP's deadlines for how you're registered for tax. Not registered for an activity (the default): for each month in which a client abroad or a private person in North Macedonia paid you, submit the calculation by the 10th and pay the tax by the 15th of the next month; companies in North Macedonia withhold the tax themselves. Registered self-employed: the monthly advance by the 15th for the previous month, the annual tax balance (ПДД-ДБ) by 15 March and any difference by 30 March |
| Settings | Business profile (EDB, address, place of issue, signatory, bank, IBAN, BIC/SWIFT, local account number), how you're registered for tax (and the monthly advance if self-employed), and VAT registration with the VAT number. The personal ID number (ЕМБГ) is never asked for, and is refused as a tax or VAT number |
| Languages | Macedonian (default), Albanian and English |

## Known limitations

- **Exchange rates are fixed.** Invoices use NBRM middle rates from
  20 Nov 2026, kept in `lib/tax/calculator.ts` and labelled as approximate;
  each invoice stores the rate it was created with. UJP converts income at
  the National Bank's middle rate on the day it was received, so the amount
  owed is approximate too. The `exchange_rate_cache` table is unused for now.
- **Nothing is emailed.** There's no email sending at all. "Issued" and
  "overdue" are labels (overdue isn't detected), and tax deadlines show up in
  the app only.
- **No credit notes.** Cancelling an issued invoice just marks it cancelled.
- **Tax rules are constants.** The DDV threshold, the flat 10% income tax
  rate and the deadlines are hardcoded in `lib/tax/calculator.ts`. The amount
  owed is 10% of the gross amount paid, while income from author's rights is
  taxed after deemed costs; UJP's approved calculation is the real figure.
  Treat the numbers as estimates, not tax advice.
- **The DDV monitor counts clients, not places of supply.** It counts every
  invoice to a client in North Macedonia and none to clients abroad, which is
  right for services to businesses abroad and most freelance services, but
  not for every kind of supply.
- **The deadlines cover two cases.** They follow the tax status you pick in
  Settings, and nothing else is tracked: no social contributions, and no
  31 March calculation for salaries from abroad. A deadline that falls on a
  weekend or public holiday isn't moved. When you're not registered, a month
  counts once a self-reported invoice is marked paid in it; the app has no
  separate payment date, so mark invoices paid in the month the money arrived.
- **No e-Faktura.** Nothing talks to UJP's systems.
- **No billing or plans.**
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
   rate and MKD total when it's saved. A draft gets its number when it's
   issued, in one `UPDATE` (`lib/invoices/numbering.ts`), with a unique index
   on (user, number); saving a draft only matches drafts
   (`lib/invoices/drafts.ts`). Migrations only add columns and indexes, since
   preview deployments run them on the production database while the old
   code is still live.
4. **Tax logic.** `lib/tax/calculator.ts` holds the constants and pure
   functions for the DDV threshold (supplies in North Macedonia), what's owed
   to UJP and the deadlines, used by the dashboard and income page, with the
   articles of the VAT and Personal Income Tax laws they follow.
5. **PDFs.** `GET /api/invoices/[id]/pdf` renders the invoice with
   `@react-pdf/renderer` in the client's invoice language, using the full
   Noto Sans for Latin and Cyrillic.
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

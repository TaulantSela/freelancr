# 🧾💶 Freelancr

<img src="public/logo.svg" alt="Freelancr logo" width="88" align="right">

Invoicing and tax tracking for freelancers in North Macedonia: clients at
home and abroad, numbered invoices in each client's language, the payments
that actually arrive, and what you owe UJP. Freelancr works out each month's
income tax from the payments you record, at the National Bank's rate on the
day each one arrived (as UJP converts it), shows your UJP deadlines, and,
until you're registered for VAT (DDV), how close your supplies in North
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
| Invoices | Line items, a date of supply, and an MKD equivalent at the National Bank's (NBRSM) middle rate on the date of supply, the day the VAT liability arises (VAT law Art. 20, 31); a future date of supply uses today's rate, and if the National Bank can't be reached the invoice falls back to a fixed rate and says so. A new invoice is a draft without a number; you can edit it, delete it or issue it. Issuing gives it the next number for its year (`INV-2026-001`) and locks it; an issued invoice can be cancelled (it's kept) but not deleted, and not once it has payments |
| VAT (DDV) | Only a user registered for VAT gets the DDV rate choice (0%, 5% or 18%); everyone else's invoices carry none, whatever the form sends (VAT law Art. 51(3), Art. 55) |
| Currencies | EUR, USD, GBP, CHF, AUD, CAD and MKD, from one shared list; each client has a default currency |
| Payments | Each payment is the money that reached your account, on the day it did: against an issued invoice, or a payout without one (a platform such as Upwork is a client). It records what was credited, fees the bank or platform took, and tax withheld at source, converted at the NBRSM middle rate on the day received, looked up live (you type the rate only if the National Bank can't be reached). How its tax is handled is fixed when it's saved: business income if you're registered self-employed, withheld by the client for a company in North Macedonia, otherwise reported by you |
| Invoice status | Paid, partly paid and overdue come from the payments: an invoice is paid once its payments (credited + fees + tax withheld) cover the total, and overdue once it's past its due date unpaid. The invoice shows its payments, the balance due, or what was overpaid; recording, editing or deleting a payment updates the invoice in the same statement |
| PDF | In the client's invoice language, with what an invoice has to state: number, date and place of issue, date of supply, the issuer's VAT number or "The issuer is not registered for VAT.", the signatory with a line to sign, and bank, IBAN and BIC/SWIFT |
| Clients | Company or private person, any country (ISO 3166 plus Kosovo), invoice language (Macedonian by default for clients in North Macedonia, English otherwise), tax ID, contact person and notes, and for clients whose payments you report yourself, the deemed costs their payments start with (author's rights only, Art. 40; 0% by default); a client with invoices or payments can't be deleted, and the app says why |
| Dashboard | What you owe UJP (late months in red, the month due by the 15th, this month so far, and what companies already paid for you this year), what you received this year, outstanding invoices with their balance, the DDV monitor, the next tax deadline still to meet, and recent invoices with their balance |
| Owed to UJP | Not registered for an activity, for each self-reported payment: income = (credited + tax withheld at source) × the NBRSM rate on the day received; base = income × (1 − deemed costs); tax = 10% of the base (Art. 11); tax paid abroad is credited up to that 10% (Art. 8(4)). Fees aren't income, so they're not in the base. A month's calculation (е-ПДД) is due by the 10th of the next month and the tax by the 15th; each month goes from to file to filed (with the calculation number), approved (with UJP's folio number) and paid, and it's late once it misses either date. A company in North Macedonia withholds the 10% for you (Art. 80), which shows as "already paid for you". Registered self-employed: the monthly advance you enter in Settings |
| DDV monitor | Your issued invoices to clients in North Macedonia this year, paid or not, by date of supply, plus their payments without an invoice by the day received, against 2,000,000 MKD, with warnings at 70%, 85% and over the threshold. Services to clients abroad don't count; hidden once you're registered for VAT or while there's no local supply |
| Payments page | A year at a time, newest month first: each month's payments, its income and tax, what's owed to UJP with the deadlines and where the calculation stands, the steps to mark it filed, approved and paid, and a flag (with a one-click fix for backfilled ones) on months where a rate isn't the National Bank's for its day. Above them, the year's totals and income by client; below, the year's tax deadlines |
| Tax deadlines | UJP's deadlines for how you're registered for tax. Not registered for an activity (the default): for each month in which a client abroad or a private person in North Macedonia paid you, submit the calculation by the 10th and pay the tax by the 15th of the next month (companies in North Macedonia withhold the tax themselves), and for each year with income, confirm or correct UJP's annual tax return (ГДП) by 31 May and pay what it shows by 30 June of the next year (Art. 96(3), 100(2)). Registered self-employed: the monthly advance by the 15th for the previous month, the annual tax balance (ПДД-ДБ) by 15 March and any difference by 30 March |
| Settings | Business profile (EDB, address, place of issue, signatory, bank, IBAN, BIC/SWIFT, local account number), how you're registered for tax (and the monthly advance if self-employed), and VAT registration with the VAT number. The personal ID number (ЕМБГ) is never asked for, and is refused as a tax or VAT number |
| Languages | Macedonian (default), Albanian and English |

## Known limitations

- **Rates come from the National Bank's public service.** They're cached
  in `exchange_rate_cache` once fetched. When it can't be reached, an
  invoice falls back to the fixed rates in `lib/tax/calculator.ts` (labelled
  approximate) and a payment asks you to type the rate; those payments, and
  ones backfilled from invoices marked paid before payments existed, are
  flagged until they use the National Bank's rate.
- **Fees aren't income.** The tax base is what was credited plus tax
  withheld at source; what a bank or platform deducted on the way is left
  out, though it still counts toward settling the invoice. If a platform's
  deduction is really a tax, enter it as tax withheld, and only with the
  foreign tax authority's certificate.
- **UJP's steps are per month.** Filed, approved and paid apply to all of a
  month's self-reported payments at once, and nothing talks to UJP: you
  record each step yourself. There are no attachments yet (е-ПДД needs the
  contract or confirmation and the bank statement).
- **Nothing is emailed.** There's no email sending at all, and tax
  deadlines show up in the app only.
- **No credit notes.** Cancelling an issued invoice just marks it cancelled.
- **Tax rules are constants.** The DDV threshold, the flat 10% income tax
  rate and the deadlines are hardcoded in `lib/tax/calculator.ts`, the tax
  maths in `lib/tax/payments.ts`. UJP's approved calculation is the final
  figure: pay against its payment order. This isn't tax advice.
- **The DDV monitor counts clients, not places of supply.** It counts every
  invoice to a client in North Macedonia (and their payments without an
  invoice) and none to clients abroad, which is right for services to
  businesses abroad and most freelance services, but not for every kind of
  supply.
- **The deadlines cover two cases.** They follow the tax status you pick in
  Settings, and nothing else is tracked: no social contributions, and no
  31 March calculation for salaries from abroad. A deadline that falls on a
  weekend or public holiday isn't moved. When you're not registered, a month
  has deadlines once you record a self-reported payment received in it.
- **No e-Faktura.** Nothing talks to UJP's systems.
- **No billing or plans.**
- **No password reset.**

## How it works

1. **Next.js 16 App Router.** Pages in `app/(dashboard)` are server components
   that query the database directly; writes go through Server Actions in
   `lib/actions/` (auth, clients, invoices, payments, rates, settings,
   locale).
2. **Auth.** Email and password with bcrypt hashes. The session is a JWT signed
   with `jose` in an httpOnly cookie that lasts 30 days, and `proxy.ts` sends
   signed-out visitors to `/sign-in`.
3. **Data.** Drizzle ORM on Neon Postgres over Neon's serverless HTTP driver.
   Tables: users, clients, invoices, invoice items, payments, and the rate
   cache. Each invoice stores its rate (with where it came from and its day)
   and MKD total when it's saved. A draft gets its number when it's issued,
   in one `UPDATE` (`lib/invoices/numbering.ts`), with a unique index on
   (user, number); saving a draft only matches drafts
   (`lib/invoices/drafts.ts`). Every payment write is one SQL statement that
   also sets the invoice's status and paid date from all its payments
   (`lib/payments/write.ts`), so the two never disagree. Migrations only add
   tables, columns and indexes, since preview deployments run them on the
   production database while the old code is still live; the one that added
   payments also created a payment for every invoice already marked paid.
4. **Rates.** `lib/rates/nbrsm.ts` fetches and parses the National Bank's
   daily lists (every calendar day, 5-second timeout) and
   `lib/rates/queries.ts` caches them; nothing is fetched at build time.
5. **Tax logic.** Pure functions with the articles of the VAT and Personal
   Income Tax laws they follow: `lib/tax/calculator.ts` for the DDV threshold
   and the deadlines, `lib/tax/payments.ts` for each payment's tax and each
   month's and year's totals, and `lib/payments/settlement.ts` for how far
   payments settle an invoice.
6. **PDFs.** `GET /api/invoices/[id]/pdf` renders the invoice with
   `@react-pdf/renderer` in the client's invoice language, using the full
   Noto Sans for Latin and Cyrillic.
7. **i18n.** Typed dictionaries in `lib/i18n/dictionaries/` (`mk`, `en`,
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
`demo@freelancr.mk` / `demo1234`, which comes with sample clients, invoices
and six months of payments dated from today (a partial payment, a company in
North Macedonia paying net of withholding, a payment with tax withheld abroad,
platform payouts without an invoice, older months filed and paid with UJP).
It fetches the National Bank's rates for those days, or uses the fixed ones,
marked as such, if it can't.

| Script | What it does |
|--------|--------------|
| `npm run db:migrate` | Apply the Drizzle migrations in `drizzle/` |
| `npm run db:seed` | Create the demo user with sample clients, invoices and payments |
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

# Freelancr

> The invoicing and tax compliance platform built for North Macedonia's 50,000+ freelancers.

## Stack

- **Next.js 16** (App Router, Server Actions, Proxy middleware)
- **TypeScript** + **Tailwind CSS**
- **shadcn/ui** (Base UI variant — new-york style, dark mode)
- **Drizzle ORM** + **Neon Postgres** (via Vercel Marketplace)
- **JWT sessions** via `jose` (httpOnly cookies, 30-day expiry)
- **bcryptjs** for password hashing

## Features (MVP)

| Feature | Status |
|---------|--------|
| Multi-currency invoicing (MKD / EUR / USD) | ✅ |
| NBRM exchange rate conversion for tax purposes | ✅ |
| DDV (VAT) threshold monitor — 2,000,000 MKD | ✅ |
| Annual income tracker with MK tax brackets | ✅ |
| Quarterly tax deadline calendar + alerts | ✅ |
| e-Faktura readiness checklist (Oct 2026) | ✅ |
| Client management (CRUD) | ✅ |
| Invoice status management (draft/sent/paid/overdue) | ✅ |
| Settings / business profile | ✅ |
| Auth (sign-up / sign-in with email + password) | ✅ |
| Landing page with pricing | ✅ |

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Link to Vercel and pull env (includes Neon DATABASE_URL)
vercel link
vercel env pull .env.local

# 3. Add a session secret locally if not set
# openssl rand -base64 32  →  add as SESSION_SECRET in .env.local

# 4. Run migrations + optional demo seed
npm run setup

# 5. Start dev server
npm run dev
```

### Production (Vercel)

```bash
vercel integration add neon          # provisions DATABASE_URL
vercel env add SESSION_SECRET production
npm run vercel-build                 # migrations + next build
vercel deploy --prod
```

Live: [https://freelancr.vercel.app](https://freelancr.vercel.app)

Open [http://localhost:3000](http://localhost:3000).

**Demo account** (after `npm run setup`):

| | |
|---|---|
| Email | `demo@freelancr.mk` |
| Password | `demo1234` |

The database is created via Drizzle migrations (`npm run db:migrate`). On Vercel, migrations run automatically during `vercel-build`.

### npm scripts

| Script | Description |
|--------|-------------|
| `npm run db:migrate` | Apply Drizzle migrations to Postgres |
| `npm run db:seed` | Seed demo user with sample clients & invoices |
| `npm run setup` | Run both migrate + seed |
| `npm run vercel-build` | Production build (migrate + next build) |

## Project Structure

```
app/
  (auth)/         sign-in, sign-up
  (dashboard)/    all authenticated pages (layout enforces auth)
    dashboard/    overview with DDV alert + stats
    clients/      client CRUD
    invoices/     invoice list + new invoice form
    income/       annual income tracker, tax breakdown, quarterly calendar
    settings/     business profile, e-Faktura checklist
  api/
    exchange-rate/ NBRM rate proxy (falls back to hardcoded approximations)

lib/
  auth/           JWT session management
  db/             Drizzle schema + SQLite init
  actions/        Server Actions (auth, clients, invoices, settings)
  tax/            MK tax constants (DDV threshold, income brackets, deadlines)
```

## Tax Logic

- **DDV threshold**: 2,000,000 MKD/year — alerts at 70%, 85%, 100%
- **Income tax brackets**: 10% on first 1,080,000 MKD, 18% above
- **Quarterly deadlines**: April 30 / July 31 / October 31 / January 31
- **Currency conversion**: NBRM official rate on invoice date (fallbacks: EUR≈61.5 MKD, USD≈56.8 MKD)

## Production Checklist

- [x] Neon Postgres via Vercel Marketplace (`DATABASE_URL`)
- [x] `SESSION_SECRET` set in Vercel production env
- [x] Drizzle migrations on deploy (`vercel-build`)
- [ ] Set up Paddle for subscription billing (Stripe is blocked in MK)
- [ ] Configure Resend for transactional email (invoice delivery, tax reminders)
- [ ] Wire up real NBRM API for exchange rates

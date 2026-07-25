# Deliver LBH — multi-vertical delivery platform

A DoorDash/Instacart-style delivery platform for Lubumbashi, DR Congo. Supports
multiple **verticals** — restaurants, grocery, pharmacy, retail and drinks —
from one app, with three user roles: **customer**, **store owner** (merchant)
and **driver** (who also does the in-store shopping for grocery/retail orders).

- **Mobile app**: Expo + React Native (iOS / Android / web), Expo Router
- **API**: Express 5 + JWT auth
- **Database**: PostgreSQL + Drizzle ORM
- Bilingual FR/EN (default FR); currency in CDF
- Payments: cash on delivery + Mobile Money (M-Pesa / Airtel)

## Monorepo layout

```text
artifacts/
  api-server/       # Express API (port $PORT)
  mobile/           # Expo React Native app
  mockup-sandbox/   # shadcn/Vite component playground (not shipped)
lib/
  db/               # Drizzle schema + connection
  api-spec/         # OpenAPI spec + Orval codegen config
  api-zod/          # Generated Zod schemas
  api-client-react/ # Generated React Query hooks
scripts/            # Utility scripts
```

## Prerequisites

- Node.js 24
- pnpm (this repo enforces pnpm — `npm`/`yarn` are blocked in `preinstall`)
- A PostgreSQL database

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
#    then fill in DATABASE_URL, PORT, JWT_SECRET (generate: openssl rand -hex 32),
#    and ADMIN_PASSWORD

# 3. Set up the database schema
#    Production: apply versioned migrations (from lib/db/migrations)
pnpm --filter @workspace/db run migrate
#    Dev shortcut: diff-push the schema directly (no migration history)
#    pnpm --filter @workspace/db run push
#    After changing the schema, generate a new migration:
#    pnpm --filter @workspace/db run generate

# 4. Seed demo stores + menu/products
pnpm --filter @workspace/api-server exec tsx src/seed.ts

# 5. Create the super-admin account (reads ADMIN_EMAIL / ADMIN_PASSWORD from env)
pnpm --filter @workspace/api-server exec tsx src/create-admin.ts

# 6. Run the API server
pnpm --filter @workspace/api-server run dev

# 7. Run the mobile app (separate terminal)
pnpm --filter mobile run start
```

## Environment variables

See [`.env.example`](.env.example). Required for the server to start:
`DATABASE_URL`, `PORT`, `JWT_SECRET`.

## Verticals

Each store has a `vertical`: `restaurant | grocery | pharmacy | retail | drinks`.
The vertical drives the customer UI (menu view vs. searchable product catalog),
the order lifecycle (kitchen prep vs. in-store picking), and merchant tools
(availability toggle vs. stock counts). Products carry grocery-ready fields —
`stockQuantity`, `unit`, `sku`, `brand`, `categoryId` — that restaurants simply
leave unset.

## Roadmap

The platform has been generalized from a restaurant-only app to multi-vertical:

1. ✅ **Foundation + vertical-aware schema** — project setup, admin seed,
   `vertical` on stores, grocery fields on products, `categories` table.
2. ✅ **Generalize** `restaurants`→`stores`, `menu_items`→`products` (code-level
   with backward-compatible aliases; canonical `/api/stores` endpoint).
3. ✅ **Grocery core** — inventory enforcement (atomic stock decrement + 409
   out-of-stock), paginated product search, aisle browse, vertical switcher.
4. ✅ **Grocery advanced** — substitutions (shopper proposes → customer
   approves), weight-based price adjustment, in-app shopper picking screen.
5. ✅ **Vertical polish** (pharmacy Rx flag, drinks age-check), admin panel
   (`artifacts/admin-panel`), auth rate-limiting + CORS allowlist, unit tests.

Run `pnpm run typecheck` and `pnpm test` to verify.

## Payments (mobile money)

Two paths exist:

- **Manual** (works today, no integration): the customer submits their M-Pesa /
  Airtel transaction reference (`PATCH /orders/:id/payment`) and an admin
  confirms it in the admin panel.
- **Automated gateway** (`POST /orders/:id/pay`): initiates a charge through the
  configured `PaymentProvider`; the provider prompts the payer's phone and later
  calls `POST /payments/webhook` to confirm/decline, which flips the order's
  `paymentStatus` and notifies the customer.

The default `PAYMENT_PROVIDER=mock` is a local sandbox (no external calls) — fully
testable: initiate, then POST the webhook with `{ transactionId, status }` and the
`x-webhook-secret` header. To go live, implement `PaymentProvider` in
`artifacts/api-server/src/lib/payments.ts` for your DRC provider/aggregator
(M-Pesa, Airtel, or e.g. Flutterwave/CinetPay/MaxiCash), register it in
`getPaymentProvider()`, and set `PAYMENT_PROVIDER` + `PAYMENT_WEBHOOK_SECRET`.

## Building the mobile app (EAS)

The app builds with [EAS Build](https://docs.expo.dev/build/introduction/).
Config is env-driven — no hardcoded project id or domain.

```bash
cd artifacts/mobile
npm i -g eas-cli && eas login
eas init                       # creates your Expo project + writes the projectId
```

Set your API domain in `eas.json` (replace `your-api-domain.example` in the
`preview`/`production` profiles), then:

```bash
eas build --profile preview --platform android      # internal test build
eas build --profile production --platform all        # store builds
eas submit --profile production                      # upload to App Store / Play
```

`app.config.ts` reads `EXPO_PUBLIC_DOMAIN` (web/router origin) and
`EAS_PROJECT_ID` from the environment; `eas init` fills the project id in.

## Typecheck / build

```bash
pnpm run typecheck   # tsc --build across project references
pnpm run build       # typecheck, then per-package builds
```

# Secure Checkout Hardening

## SQL migration

Apply `supabase/migrations/20260816000003_harden_checkout_security.sql` after the existing secure order-creation migration. The migration adds an early maximum of 50 order items, a 128 KiB JSON payload limit, and a maximum of 20 customizations per item. These checks run before the private writer performs catalog loops, reducing input-amplification risk.

The migration also replaces `public.secure_order_updates()` with an empty `search_path` and fully qualified catalog calls. It revokes direct execution from client roles and preserves the existing trigger-based vendor status allowlist.

## Frontend wrapper

`src/features/checkout/api/orderClient.ts` exposes `placeOrder()` and `sanitizeOrderError()`. The wrapper sends only order intent to `create_order`; it does not send totals, fees, catalog prices, or authoritative dish names. After the RPC returns an order ID, it reads the protected `orders` row and returns `items_total`, `delivery_fee`, `grand_total`, and `status` from the database. These values are authoritative for confirmation, reconciliation, and future payment integration.

The wrapper converts authentication, address, catalog, payload, duplicate-order, and unknown database failures to stable user-facing messages. SQLSTATE codes are retained only as an internal typed field and raw database error strings are never rendered by the checkout page.

## Tests and CI

`npm run test:checkout` executes `scripts/test-checkout.mjs` against a disposable Supabase database. It verifies server-derived names and prices, authoritative totals, cross-user address rejection, and the customization-array limit. `npm run test:rls` continues to verify customer/vendor RLS and order status transitions.

The reusable `.github/workflows/rls-security.yml` workflow now runs both suites after rebuilding the database from migrations and running `supabase db lint --local`. The existing deployment workflow already waits for this reusable job before building and publishing the site.

## Required validation

Run the following in a Docker-enabled environment:

```sh
supabase start
source <(supabase status -o env)
npm ci
supabase db reset --local
supabase db lint --local
npm run test:rls
npm run test:checkout
supabase stop --no-backup
```

The migration and suites must be applied and executed in staging before production. If the existing database has already applied a migration with a later timestamp, preserve the repository migration order or create a new timestamped migration rather than editing an applied migration.

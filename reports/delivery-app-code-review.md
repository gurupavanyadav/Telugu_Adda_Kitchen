# Delivery App Code Review

**Reviewer:** Manus AI  
**Scope:** React/Vite/TypeScript frontend, Supabase client integration, database migrations, and CI configuration in the supplied archive.  
**Review basis:** Static inspection of the repository plus `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm audit --omit=dev`.

## Executive assessment

The project is a compact, reasonably organized campus-food-ordering application with a clear feature-oriented frontend structure and a database-backed checkout flow. The production build and TypeScript checks pass, which indicates that the codebase is currently buildable. However, the application is not ready for a reliable production rollout because its **frontend authorization model is inconsistent with the final database authorization model**, and the order-creation RPC still trusts several client-controlled values.

The most urgent issue is the role-boundary mismatch. The frontend only recognizes `profiles.role = 'admin'`, while the later migrations introduce `user_roles.role = 'vendor'`, remove the old admin policies, and authorize menu and order operations through `private.is_vendor()`. A vendor account can therefore be authorized by the database but blocked by the UI, while the UI’s “Admin Dashboard” operations can fail at the database layer. The next urgent issue is order integrity: the server recalculates prices, but it adds customization prices supplied by the client without checking them against the dish’s stored customization list, and it accepts the client-supplied delivery fee and fulfillment/address combination with no corresponding server-side validation.

| Area | Assessment | Priority |
|---|---|---:|
| Buildability | TypeScript and production build pass. | Good |
| Authorization | Frontend uses `admin`; final RLS uses `vendor`. | **P0** |
| Order integrity | Server validates base dish price and availability but trusts customization prices and fee inputs. | **P1** |
| Ordering UX | Unavailable dishes can be added to the cart and are rejected only at checkout. | **P1** |
| Error handling | Several Supabase errors are ignored, producing silent failures. | P1/P2 |
| Maintainability | Feature structure is understandable; lint has four warnings and no automated test script is defined. | P2 |
| Dependency hygiene | `npm audit --omit=dev` reports one high-severity transitive `ws` vulnerability with a fix available. | P1 |

## Findings

### P0 — Frontend and database authorization models are incompatible

The frontend loads a role from `profiles.role` and gates the dashboard on the literal value `admin` in `src/features/admin/pages/AdminPage.tsx:14-35`. The shared header applies the same assumption. In contrast, `supabase/migrations/20260808205313_vendor_auth_boundary.sql:2-36` creates `public.user_roles`, defines the only accepted role as `vendor`, and introduces `private.is_vendor()`. The same migration removes the earlier admin menu policies and replaces them with vendor-only policies at lines 38-65. `20260809000002_vendor_order_updates.sql:46-69` likewise removes the legacy admin order policies and creates vendor-only order and order-item access.

This creates two concrete failures. A legitimate vendor may be redirected away from `/admin` because the frontend sees no `admin` role. Conversely, changing the frontend role value to `admin` alone would not make database writes succeed, because the final RLS policies check `user_roles` and `private.is_vendor()`, not `profiles.role`. The result is a broken administrative workflow and an authorization boundary that is difficult to reason about.

**Recommendation:** Choose one canonical role model and use it end to end. The simplest correction is to expose a small authenticated role query or view backed by `user_roles`, have `AuthProvider` load `vendor` status, and gate both the header and dashboard on that status. Keep RLS as the authoritative enforcement layer; the frontend gate should be treated only as navigation UX. Add an integration test that verifies a vendor can read orders, update permitted order fields, and toggle dish availability, while an ordinary customer cannot.

### P1 — The order RPC does not fully validate client-controlled pricing inputs

The finalized function in `supabase/migrations/20260809000003_resolve_linter_warnings.sql:43-68` correctly fetches the current dish price and rejects unavailable dishes. Nevertheless, customization prices are taken directly from each incoming JSON customization at lines 60-65 and 97-103. There is no comparison with the selected customization objects stored in `dishes.customizations`. The frontend sends the full customization objects from the cart in `src/features/checkout/pages/CheckoutPage.tsx:46-59`, so an authenticated caller can invoke the RPC with altered customization prices and make the server calculate and persist those altered prices.

The same function calculates the grand total using the supplied `p_delivery_fee` at lines 71-80. It does not enforce that pickup has a zero fee, that delivery has the configured fee, or that delivery includes a non-null address. It also does not require a non-empty item list or explicitly validate that quantity is a positive integer before doing the numeric calculation. The database check on `order_items.quantity` catches some invalid values only after the order insert has begun, while fractional input can be calculated numerically and then cast to an integer during item insertion, producing inconsistent order totals and line-item quantities.

**Recommendation:** Treat the RPC as an untrusted API boundary. Accept only dish IDs, quantities, and canonical customization identifiers or labels. Load the dish and its customization definitions inside the function, validate every selection and price from the database, enforce `quantity` as an integer within a reasonable limit, reject an empty cart, derive the delivery fee from `p_fulfillment_type`, and require or reject the address according to the fulfillment type. Prefer a single server-side total calculation rather than comparing against client totals; client totals should be display-only.

### P1 — Unavailable dishes can be offered and added to the cart

`src/features/menu/pages/MenuPage.tsx:27-36` selects `dishes.is_available` but never filters on it. The card-level add button at lines 143-160 therefore allows an unavailable dish to enter the cart. The direct detail page has the same problem: `DishDetailPage.tsx:17-24` loads any dish by ID, and `handleAddToCart` at lines 40-45 does not check `dish.is_available`. The final RPC rejects unavailable dishes at `20260809000003_resolve_linter_warnings.sql:46-54`, so the user can complete the menu and checkout flow only to receive a generic “Failed to place order” message.

**Recommendation:** Filter unavailable dishes in the menu query or immediately after mapping, render an explicit unavailable state, and disable both add-to-cart entry points. Retain the server-side availability check because menu state can change between browsing and checkout, but translate that expected race into a specific, recoverable message that removes or refreshes the affected item.

### P1 — Supabase errors are frequently swallowed, causing silent failures

The admin loaders in `AdminPage.tsx:44-61` inspect only `data`, while status and dish mutations at lines 63-84 update local state only when no error occurs and otherwise show no feedback. The profile page similarly ignores errors from address inserts, updates, deletes, and reloads in `ProfilePage.tsx:39-54`. This can leave users looking at stale data or believing an operation succeeded when RLS rejected it—especially likely while the admin/vendor mismatch remains unresolved.

**Recommendation:** Centralize a small error-normalization helper, preserve and display actionable errors, disable controls during mutations, and refresh data after successful writes. For authorization failures, show a clear “you do not have permission” state rather than silently leaving the old value in place.

### P1 — Dependency audit reports a high-severity transitive vulnerability

`npm audit --omit=dev` reports one high-severity vulnerability in `ws`, with the installed package resolved through `@supabase/realtime-js` under `@supabase/supabase-js`. The installed tree is `ws@8.18.3`, and npm reports a fix is available. This is not evidence that the application is exploitable in its current deployment, but it is a release hygiene issue that should be resolved or documented before production deployment.

**Recommendation:** Run the package-manager fix or update the Supabase dependency to a version whose realtime dependency resolves outside the vulnerable range, then rerun the audit and build. Review the resulting lockfile diff rather than applying a broad, unreviewed override.

### P2 — Menu date selection uses UTC while the UI presents the local date

`MenuPage.tsx:27` builds the database date with `new Date().toISOString().split('T')[0]`, which is UTC. The page heading at line 69 uses the browser’s local timezone. For users in a positive UTC offset, shortly after local midnight the heading can show the new local day while the query still requests the previous UTC day. This can produce an apparently empty or incorrect menu during the boundary window.

**Recommendation:** Compute the date in the restaurant’s intended timezone, preferably server-side or with an explicit timezone-aware utility. Use the same date value for both the heading and query, and add tests around midnight in the deployment and customer timezones.

### P2 — Cart totals disagree with pickup checkout

`CartProvider` always assigns `DELIVERY_FEE` when the cart is non-empty at `src/features/cart/context/cart.tsx:79-85`. Checkout later sets the fee to zero for pickup at `CheckoutPage.tsx:31-33`. As a result, the cart drawer can show a delivery fee and grand total that are not applicable to the selected pickup option. This is a correctness and trust issue rather than a server-side pricing vulnerability.

**Recommendation:** Make the cart subtotal the only fulfillment-independent cart value. Compute delivery fee and grand total in a checkout/order-summary component based on the selected fulfillment type, or pass the fulfillment choice into the cart summary explicitly.

### P2 — Cart item identity is based only on customization labels

`cart.tsx:28-30` creates a customization key from sorted labels only. Two customization objects with the same label but different prices or definitions collide and are merged. The detail page also uses the label as the selection identity at `DishDetailPage.tsx:28-33` and `95-99`. This is unlikely with carefully curated data, but it makes the cart dependent on label uniqueness and can create incorrect quantities or totals after catalog changes.

**Recommendation:** Give each customization a stable ID, or derive the key from a canonical serialization containing the stable ID and price. Enforce uniqueness in the dish data model and validate the selection server-side.

### P2 — Profile data loading has a stale dependency and weak lifecycle handling

The lint check reports `react-hooks/exhaustive-deps` at `ProfilePage.tsx:16-19`, where `loadAddresses` is called from an effect but is not in the dependency array. The function also uses `user!` and can update state after navigation if the request resolves late. The current code is likely to work in common cases, but the warning indicates the lifecycle contract is not explicit.

**Recommendation:** Define the loader with `useCallback` over `user?.id`, include it in the effect dependencies, and guard state updates with cancellation or an abort pattern. Handle load errors separately from an empty address list.

### P2 — CI does not enforce typecheck or lint

The repository defines `typecheck`, `lint`, and `build` scripts in `package.json:6-11`, but `.github/workflows/deploy.yml:25-29` runs only `npm ci` and `npm run build`. The local review found four lint warnings, including the profile hook warning. A future type or lint regression could therefore be merged and deployed as long as the production bundle still compiles.

**Recommendation:** Add separate CI steps for `npm run typecheck` and `npm run lint`, and decide whether warnings should be promoted to errors. Add a test step once automated tests exist.

### P2 — Configuration is coupled to a specific Supabase project

`src/lib/supabase.ts:3-6` falls back to a hardcoded Supabase URL and anon key when environment variables are absent. The anon key is intended for client use and is not equivalent to a service-role secret, but a fallback still makes an unset deployment silently connect to the repository’s default project. This creates a real risk of staging/production data being mixed with the wrong frontend build.

**Recommendation:** Require `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build time, fail clearly when they are absent, and inject them through the deployment environment. Keep the fallback out of source control.

## Validation results

| Check | Result | Interpretation |
|---|---|---|
| `npm ci` | Passed | Lockfile is installable in the review environment. |
| `npm run typecheck` | Passed | No TypeScript compiler errors were found. |
| `npm run lint` | Passed with 4 warnings | No lint errors; warnings concern Fast Refresh exports and the profile hook dependency. |
| `npm run build` | Passed | Vite produced a production bundle. It emitted an outdated Browserslist database notice. |
| `npm audit --omit=dev` | Failed with 1 high vulnerability | The reported issue is transitive `ws`, with a fix available. |
| Automated application tests | Not available | `package.json` defines no test script; only manual SQL test files are present under `supabase/tests/manual`. |

## Recommended implementation order

First, reconcile the vendor/admin authorization model and add an end-to-end authorization test. Second, harden `create_order` so all monetary and fulfillment values are derived or validated from database state. Third, prevent unavailable items from entering the cart while retaining the server-side race-condition check. Fourth, add visible error handling to admin/profile mutations and fix the dependency audit result. Finally, correct timezone-aware menu selection, cart totals, hook dependencies, and CI quality gates.

> **Bottom line:** The code is buildable and has a sensible feature layout, but the current release should be treated as **not production-ready** until the role boundary and server-side order validation are corrected.

## Repository evidence

[1]: ./delivery-app/src/features/admin/pages/AdminPage.tsx "Frontend admin dashboard and role gate"
[2]: ./delivery-app/src/features/auth/context/auth.tsx "Frontend profile-role loading"
[3]: ./delivery-app/src/lib/supabase.ts "Supabase client configuration and shared types"
[4]: ./delivery-app/src/features/checkout/pages/CheckoutPage.tsx "Checkout RPC payload"
[5]: ./delivery-app/src/features/menu/pages/MenuPage.tsx "Menu query and add-to-cart behavior"
[6]: ./delivery-app/src/features/menu/pages/DishDetailPage.tsx "Dish detail and add-to-cart behavior"
[7]: ./delivery-app/src/features/cart/context/cart.tsx "Cart identity and total calculations"
[8]: ./delivery-app/src/features/profile/pages/ProfilePage.tsx "Address management and hook warning"
[9]: ./delivery-app/supabase/migrations/20260808205313_vendor_auth_boundary.sql "Vendor role and menu RLS policies"
[10]: ./delivery-app/supabase/migrations/20260809000002_vendor_order_updates.sql "Vendor order RLS policies and update trigger"
[11]: ./delivery-app/supabase/migrations/20260809000003_resolve_linter_warnings.sql "Final order-creation RPC"
[12]: ./delivery-app/.github/workflows/deploy.yml "Deployment workflow"
[13]: ./delivery-app/package.json "Project scripts and dependencies"

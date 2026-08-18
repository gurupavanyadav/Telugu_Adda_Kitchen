# Delivery App — P0 Closure and P1 Verification Report

**Prepared:** 18 August 2026  
**Scope:** Repository-controlled P0 remediation, completed P1 implementation verification, and remaining release evidence.  
**Operating model:** Single trusted restaurant operator.

## Executive conclusion

The repository now contains implementations for every **code-controlled P0 remediation** identified in the launch-readiness review. The unsafe Supabase fallback is removed, the production dependency audit is clean, the vendor access model is now a deliberately narrow fulfillment contract, and migration/deployment governance artifacts are in place.

However, the application is **not yet eligible for an unconditional production launch**. Three P0 acceptance checks require execution against the real protected staging or production environment: confirmation that hosted migration history matches the reviewed repository, execution of the hosted policy/grant inventory, and proof that protected GitHub migration/rollback controls are configured and rehearsed. These are operational evidence gaps rather than missing repository code. They must be closed with recorded CI/staging evidence before a public launch.

| Overall area | Repository implementation | Verification status | Release interpretation |
| --- | --- | --- | --- |
| P0-01: migration and policy drift | Migration manifest, hosted inventory query, and protected migration workflow added | Static validation passed; hosted execution pending | **Blocked on environment evidence** |
| P0-02: Supabase fallback | Removed; explicit public config required for every build | Four configuration tests passed | **Implemented and verified statically** |
| P0-03: dependency vulnerability | `ws` override applied and lockfile refreshed | Production audit found zero vulnerabilities | **Implemented and verified** |
| P0-04: vendor visibility | Single-operator fulfillment RPC contract and UI migration added | TypeScript, manifest, and test syntax passed; live RLS run pending | **Implemented; live authorization proof pending** |
| P0-05: deployment/recovery controls | Protected migration workflow, policy inventory, and release procedure added | Static validation passed; protected-environment rehearsal pending | **Blocked on environment evidence** |

## P0 remediation detail

### P0-01 — Hosted schema, migration, and policy verification

The migration chain is now treated as an immutable release artifact. The manifest at `supabase/verification/migration-checksums.sha256` tracks all 14 reviewed migration files, including the new idempotency and vendor-contract migrations. `npm run verify:migrations` verifies the exact checksums before a deployment can proceed.

The new hosted inventory at `supabase/verification/policy_grant_inventory.sql` verifies the expected migration versions, fails when known broad legacy vendor/admin policies remain, rejects old public `create_order` and private writer grants, verifies that direct authenticated `orders` updates are revoked, and checks the two approved vendor fulfillment RPC grants. `.github/workflows/supabase-migration.yml` is the protected workflow intended to link to the target project, push the reviewed migration set, execute the inventory, and retain evidence.

This removes the previous lack of a repeatable migration-control mechanism. It does **not** prove that a hosted Supabase project currently matches the repository, because no protected project credentials or hosted environment were available in this execution environment.

### P0-02 — Explicit Supabase configuration

`src/lib/supabase.ts` no longer contains a hosted project URL or anonymous-key fallback. `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are required. The client rejects missing values, placeholders, malformed endpoints, non-HTTPS release endpoints, and malformed Supabase public keys. During local Vite development only, an explicitly configured loopback HTTP endpoint is permitted.

The Vite build configuration applies the same release guard before compiling. The GitHub Pages workflow receives the public endpoint and publishable/anonymous key from repository or protected-environment variables. `.env.example` documents the local configuration contract. The test suite confirms that an absent, malformed, or placeholder configuration blocks a release build and that an explicit valid configuration builds successfully.

### P0-03 — Production dependency audit

The high-severity transitive `ws` issue was remediated with the narrow `package.json` override `ws: 8.21.0`, followed by a lockfile refresh. `npm run audit:prod` runs `npm audit --audit-level=moderate --omit=dev`, and CI includes the production dependency audit. `dependency-audit-evidence.md` records the original dependency path and compatibility review.

The current production audit returned **zero vulnerabilities**. This conclusion applies to the installed, reviewed lockfile at the time of this report. It must remain a required pull-request and release check because new advisories can be published after this review.

### P0-04 — Approved single-operator vendor data boundary

The confirmed operating model is a **single trusted restaurant operator**, not a multi-vendor marketplace. A vendor therefore needs fulfillment details for restaurant orders, but not customer account identifiers, billing totals, item prices, or raw database-table access.

Migration `20260816000006_vendor_fulfillment_contract.sql` removes the broad vendor order/order-item select policies and direct order update policy. It revokes authenticated direct `orders` updates and introduces two restricted RPCs:

| RPC | Permitted output or input | Explicitly excluded |
| --- | --- | --- |
| `list_vendor_fulfillment_orders()` | Order number, fulfillment mode, delivery snapshot when required, status, notes, creation time, item names, quantities, customizations | Customer `user_id`, profiles, all order totals, dish prices, line totals, raw table reads |
| `update_vendor_order_fulfillment(order_id, status, notes)` | Status and operational notes only | Direct table updates, pricing, address, ownership, order-number, and audit-field modification |

Both functions use `SECURITY DEFINER` with an empty `search_path`, enforce the canonical vendor role, revoke public/anonymous execution, and grant only authenticated execution. The existing `secure_order_updates` trigger remains the authority for allowed status transitions and protected immutable fields. The staff dashboard now uses these RPCs and no longer displays the order total in its fulfillment view. The approved boundary is documented in `vendor-fulfillment-data-boundary.md`.

The live RLS suite was updated to prove that a vendor cannot directly read raw orders or item pricing, can receive the fulfillment projection, and cannot directly mutate an order. It requires a Docker-backed local Supabase instance or staging project to execute.

### P0-05 — Protected deployment, migration, and recovery controls

The deployment chain now includes repository checks before the GitHub Pages deployment, while the new dedicated Supabase migration workflow is intended to run only from a protected target environment. The workflow consumes environment-scoped Supabase credentials rather than browser-public variables, validates the immutable migration manifest, applies the migration set, runs the hosted policy/grant inventory, and saves reviewable artifacts.

`supabase-migration-release-procedure.md` provides a release sequence, required approvals, a pre-migration backup expectation, post-migration smoke tests, and a forward-fix/rollback approach. Because database migrations are not safely reversible by default, the procedure requires a backup and a forward-fix plan rather than an unsafe automatic schema rollback.

The repository contains the required controls. A release manager must still configure the GitHub protected environment, required reviewers, secrets, and branch protections, then perform one observed staging rehearsal to turn these controls into evidence.

## Completed P1 implementation and verification

### P1-01 — Server-enforced order idempotency

Migration `20260816000005_add_order_idempotency.sql` creates a customer-scoped idempotency record keyed by a client UUID and a deterministic request fingerprint. The order RPC reserves that key before creating an order. A repeat submission with the same key and matching intent returns the original order; a reused key with different intent is rejected. The key reservation provides transaction-level serialization for concurrent duplicate submissions, so two requests with the same key cannot create two orders.

The checkout client carries the idempotency key to the RPC, maps unsafe reuse to a stable customer message, and the checkout page retains a single UUID/order-number attempt for retries during the mounted placement attempt. `scripts/test-checkout.mjs` includes replay, conflicting-key, and concurrent-request cases.

The behavior is implemented and the test file is syntactically valid. Its database behavior has not been executed in this sandbox because a local Supabase stack requires Docker or Podman, neither of which is available here.

### Prior P1-capable security controls covered by the verification pass

The existing RLS, checkout, address-isolation, secure-RPC, and configuration-control suites remain present and are wired into the reusable security workflow. Static verification confirmed the following scripts parse correctly: `scripts/test-rls.mjs`, `scripts/test-checkout.mjs`, and `scripts/test-address-rls.mjs`. The configuration suite executed successfully and verifies the P0-02 release guard.

The next unimplemented P1 enhancement is **server-generated order identifiers**. The current P1-01 implementation deliberately preserves the existing client-generated display order number to avoid changing that contract simultaneously. It should be addressed after the live test pass, before payment or receipt integrations rely on an externally predictable order identifier.

## Verification evidence

| Check | Command or evidence | Result | Notes |
| --- | --- | --- | --- |
| Supabase public configuration | `npm run test:supabase-config` | **Pass: 4/4** | Tests missing, malformed, placeholder, embedded-fallback, and valid release configuration paths |
| TypeScript | `npm run typecheck` | **Pass** | Includes staff dashboard migration to vendor RPCs |
| Source lint | `npm run lint` | **Pass with 4 pre-existing warnings** | Zero errors; warnings are Fast Refresh export structure (3) and one missing effect dependency |
| Migration immutability | `npm run verify:migrations` | **Pass** | 14 reviewed migration artifacts verified |
| Production dependency audit | `npm run audit:prod` | **Pass** | Zero production vulnerabilities at moderate-or-higher severity threshold |
| Production build | `npm run build` with explicit public Supabase variables | **Pass** | Bundle builds; Vite reports a non-blocking large-chunk advisory |
| RLS test syntax | `node --check scripts/test-rls.mjs` | **Pass** | Live database run pending |
| Checkout/idempotency test syntax | `node --check scripts/test-checkout.mjs` | **Pass** | Live database run pending |
| Address RLS test syntax | `node --check scripts/test-address-rls.mjs` | **Pass** | Live database run pending |
| Patch hygiene | `git diff --check` | **Pass** | No whitespace errors |

The production build emitted two non-blocking advisories: the local Browserslist data is outdated, and the primary JavaScript output is above Vite's 500 KB chunk advisory threshold. Neither is a P0 blocker, but the dependency metadata should be refreshed in the next maintenance pass and route-level code splitting should be evaluated before performance-sensitive rollout.

## Required external evidence before launch

The following checklist is required to close the remaining operational evidence gaps. These steps should be performed first in staging with the same migration history and Supabase plan/quota configuration expected for production.

| Gate | Required action | Evidence to retain | Owner |
| --- | --- | --- | --- |
| Hosted migration history | Link the protected staging project and run the migration workflow | Workflow run, migration history output, immutable-manifest artifact | Backend/DevOps |
| Hosted policy inventory | Execute `supabase/verification/policy_grant_inventory.sql` after migration | Query output showing success | Security/Backend |
| Live RLS matrix | Start Supabase locally or configure staging test credentials; run RLS, checkout, and address suites | Test logs and versioned CI run | Security/Backend/QA |
| Idempotency concurrency | Execute the two-simultaneous-request and same-key replay cases against staging | Test logs showing one created order and stable replay ID | Backend/QA |
| Protected deployment | Configure GitHub environment protection, branch protection, required checks, variables, and secrets | Screenshots/export of environment settings and a successful gated run | DevOps |
| Recovery rehearsal | Take a staging backup, simulate a failed migration response, and execute the documented forward-fix path | Backup reference, incident timeline, recovery sign-off | Operations/Backend |
| Vendor privacy review | Confirm staff handling policy for delivery addresses/notes and restrict vendor role assignment | Product/security approval | Product/Security |

### Suggested staging execution sequence

```bash
# In a Docker-enabled local environment, or use equivalent staging credentials.
supabase start
supabase db reset --local
supabase db lint --local

# Export values from the local/staging environment appropriate to the test scripts.
export API_URL="..."
export ANON_KEY="..."
export SERVICE_ROLE_KEY="..."

npm run test:rls
npm run test:checkout
npm run test:address-rls
```

For the protected hosted environment, configure `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` in the intended scopes. The `VITE_*` values are browser-public configuration values; do **not** place a Supabase service-role secret in a `VITE_*` variable.

## Migration order

The target environment must apply the reviewed migrations in ascending order. Do not reorder or edit applied migration files; add a new migration for any correction.

| Order | Migration | Purpose |
| --- | --- | --- |
| 1 | `20260816000000_harden_order_creation.sql` | Base private order-writing boundary |
| 2 | `20260816000001_fix_sec01_sec03.sql` | Direct-write denial and constrained vendor updates |
| 3 | `20260816000002_secure_create_order_rpc.sql` | Server-derived checkout totals |
| 4 | `20260816000003_harden_checkout_security.sql` | Checkout payload/search-path hardening |
| 5 | `20260816000004_remove_legacy_admin_rls.sql` | Canonical role model and legacy-policy removal |
| 6 | `20260816000005_add_order_idempotency.sql` | Replay-safe, concurrent duplicate-order prevention |
| 7 | `20260816000006_vendor_fulfillment_contract.sql` | Minimal single-operator vendor fulfillment access |

## Final release recommendation

**Recommendation: conditional no-go until the external evidence checklist is completed.** The source-level P0 implementation is materially stronger than the original review baseline, and all available static/build/dependency checks now pass. Nevertheless, an authorization and migration-control release cannot be considered complete without executing the changed policies and order-RPC concurrency behavior on the actual Supabase engine and confirming the protected deployment workflow against a real target project.

Once the seven external evidence gates above are captured, the remaining launch work should prioritize P1-02 server-generated order identifiers, the four pre-existing lint warnings, proactive code splitting for the large initial bundle, and the broader privacy/accessibility/reliability acceptance gates from the original readiness review.

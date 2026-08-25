# Telugu Adda Kitchen — Deep Code Audit and Project Status

**Audit date:** 25 August 2026

**Repository baseline:** `main` at `bd17e420f7d67d85c339860a7e341d62099f2f41` (`fix(recovery): accept current API key formats`)
**Scope:** Read-only review of the React/Vite frontend, Supabase migrations and live advisors, tests, GitHub workflows, repository governance, and current project state. No code, migration, secret, workflow, GitHub setting, or Supabase project was changed during this audit.

## Executive status

The **defined P0 security and recovery closure remains valid**. The protected production migration, forward-only Auth-trigger execution fix, production runtime verification, and encrypted isolated recovery rehearsal all have successful evidence. The current production project is healthy, has the expected 21 migrations, and the recovery drill remains paused while staging is healthy. [1] [2]

However, the repository and environment are **not ready for an unqualified public product launch**. The strongest reasons are operational and product-readiness gaps rather than a newly discovered P0 database-access bypass: production currently has **zero rows** in every application table, no application-hosting/deployment workflow is evidenced, every workflow is manual-only, branch protection is absent, and dependency/security automation is incomplete. The application is a hardened database-backed foundation, but it is not yet an operationally complete restaurant service.

> **Decision:** Treat P0 as closed for its agreed security/migration/recovery scope, but treat the overall product as **NO-GO for a public launch** until the high-priority operational, dependency, and business-rule items below are resolved and re-verified.

| Area | Current status | Audit conclusion |
| --- | --- | --- |
| P0 database security and recovery | **Pass** | The last approved production verification and recovery rehearsal succeeded. |
| Production database health | **Healthy** | The dashboard reports healthy nano compute in Mumbai; no Edge Functions are deployed. |
| Production application data | **Empty** | Profiles, dishes, daily menus, addresses, orders, order items, and user roles each report zero rows. This blocks practical ordering. |
| Frontend compilation | **Pass with warnings** | Type-check, configuration regression suite, migration-manifest verification, and a secretless format-valid production build pass. |
| Runtime production dependency exposure | **Pass** | `npm audit --omit=dev` reports zero vulnerabilities. |
| Development and CI dependency posture | **Needs remediation** | Full audit reports 17 findings, including 11 high-severity development/build-tool findings with fixes available. |
| GitHub deployment gating | **Partially strong** | Production environment approval, main-only deployment branch, and no administrator bypass are configured. |
| General repository governance | **Weak** | No branch protection/ruleset, no automatic CI trigger, Dependabot disabled, code scanning not configured, and no security policy. |

## What was verified

The audit used an isolated checkout, installed only lockfile-resolved dependencies, and performed non-destructive checks. Production secrets, database passwords, API keys, service-role keys, and backup passphrases were never read or printed.

| Check | Result | Interpretation |
| --- | --- | --- |
| `npm ci` | Completed | Lockfile resolves and installs. |
| TypeScript check | Passed | No TypeScript errors. |
| Supabase configuration regression suite | **4/4 passed** | The frontend rejects absent, malformed, placeholder, or embedded hosted configuration and accepts explicit format-valid public configuration. |
| Migration checksum manifest | **21 artifacts verified** | Local migration artifacts match the immutable manifest. |
| Production build without configuration | Failed closed as designed | Build refuses to run without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. |
| Production build with non-secret, format-valid audit configuration | Passed | Built successfully; the main JavaScript bundle is 647.81 kB uncompressed / 159.74 kB gzip and triggers Vite’s chunk-size warning. |
| Production-only dependency audit | **0 vulnerabilities** | The shipped browser dependency set is not flagged by the current npm audit database. |
| Full dependency audit | **17 findings** | 2 low, 4 moderate, and 11 high; these are build/development dependencies, not the runtime dependency set. |
| ESLint | 0 errors, 4 warnings | See maintainability findings below; the parser also warns that TypeScript 5.6.3 is outside the installed parser’s declared support range. |
| Current production schema | 21 migrations; 7 public application tables with RLS enabled | Schema baseline is intact, but all application tables are empty. |
| Live Supabase advisors | Findings present | Security and performance findings are evaluated below, rather than ignored. |

## Strengths confirmed

The database-facing security model is substantially better than a typical client-driven checkout implementation. The public order RPC accepts intent but derives item names, prices, customization prices, totals, delivery address snapshots, and initial order state server-side. Direct customer writes to `orders` and `order_items` are revoked, the RPC is limited to authenticated callers, and the test suite covers cross-customer access, direct-write attempts, price tampering, status escalation, vendor fulfillment boundaries, idempotency replay, concurrent duplicate submission, and foreign-address use. [3]

The vendor design also remains appropriately narrow for the confirmed **single trusted restaurant operator** model. Vendors retrieve operational fulfillment data only via a shaped RPC that omits customer IDs, prices, and totals, and they update fulfillment only through a guarded RPC and status-transition trigger. The Supabase advisor warns because these functions are intentionally `SECURITY DEFINER` and callable by authenticated users; this is an expected structural warning, not evidence that any authenticated caller becomes a vendor. The functions use fixed search paths and server-side `auth.uid()` / `private.is_vendor()` checks, and the live suites exercised customer and vendor abuse cases. [3] [4]

The operational P0 work is also genuine rather than paper-only. The ninth recovery rehearsal completed logical role/schema/data/migration-history export, AES-256 encryption, checksum validation, isolated restore, policy/grant inventory, 21-migration and six-core-relation checks, RLS **13/13**, checkout **6/6**, and address RLS **6/6**. The production project was not restored or overwritten. [2]

## Priority findings

### High priority

| ID | Finding | Evidence and impact | Recommended corrective direction |
| --- | --- | --- | --- |
| **H-01** | Production has no application data | All seven production application tables currently report zero rows. There is no visible menu/catalog, no daily menu, no operator/vendor setup, and no customer content. A healthy empty database cannot accept useful real orders. | Define a separately approved production-readiness seeding/onboarding procedure. It must create an operator role, catalog, daily menu, opening hours, delivery rules, and test the resulting customer and operator paths. Do not seed sample production customer data. |
| **H-02** | No automatic CI and no branch protection | All eight workflows use `workflow_dispatch` only. The GitHub Branches page reports no classic branch protection and no visible ruleset. Changes can reach `main` without a required review, status check, or automated validation. | Add a pull-request/push CI workflow for type-check, lint, configuration test, migration-manifest verification, build, and production-only audit. Add a `main` ruleset requiring pull requests, review, required checks, signed/linear history as appropriate, and force-push/deletion prevention. Keep production workflows separately gated. |
| **H-03** | Development/build dependency stack has known high vulnerabilities | Full `npm audit` reports 11 high findings. Direct vulnerable packages include `vite@5.4.8` and `postcss@8.4.47`; transitive findings include Rollup, esbuild, glob, minimatch, brace-expansion, js-yaml, and related build tooling. Production-only audit is clean, so this is a build/CI/developer-machine concern rather than a detected browser-runtime dependency flaw. | Upgrade Vite, PostCSS, and the lockfile through a controlled compatibility branch; rerun build, lint, type-check, static configuration tests, and hosted staging verification. Use Dependabot alerts/updates after enabling them. |
| **H-04** | Security automation and disclosure channels are incomplete | GitHub shows Dependabot alerts disabled, code scanning not configured, private vulnerability reporting disabled, and no security policy. Secret scanning is enabled. | Enable Dependabot alerts and security updates, add CodeQL or equivalent source scanning, publish `SECURITY.md`, and enable private vulnerability reporting if the operating model supports it. |

### Medium priority

| ID | Finding | Evidence and impact | Recommended corrective direction |
| --- | --- | --- | --- |
| **M-01** | Checkout does not enforce daily-menu eligibility | The UI fetches `daily_menus`, but the authoritative `private.internal_create_order` validates only the dish row’s `is_available` state. It does not query `daily_menus`, `menu_date`, or meal availability. A signed-in caller who knows another available dish ID can request it directly through the RPC even when it is not on today’s selected menu. | Add a forward-only migration that resolves the restaurant business date/time zone and validates that each ordered dish is on an eligible daily menu for the requested/current fulfillment window. Add a negative live test for an available but non-menu dish. |
| **M-02** | No explicit maximum customization count per line item | The RPC caps items at 50 and checks each customization’s shape/label, but does not cap `jsonb_array_length(customizations)`. The existing “oversized customization” test is rejected because its first label is not in the catalog, not because a size limit is enforced. An authenticated caller can submit a large array and make the function iterate it. | Add a server-side maximum—for example, 20 selections per line item—before the nested catalog loop. Update the test to use valid repeated/unique catalog labels or a measurable failure message so it proves the bound. |
| **M-03** | Restaurant business time is client-local and inconsistent | `MenuPage` uses UTC `toISOString()` for `menu_date`, while meal selection and order-number generation use the browser’s local time. Users around midnight in India, or users in other time zones, can see the wrong menu date/meal. | Make the restaurant business time zone explicit (for example, `Asia/Kolkata`) and calculate menu availability server-side or through a vetted query/RPC. Use the same source for UI display and checkout enforcement. |
| **M-04** | Client-generated order number has a small daily suffix space | `generateOrderNumber()` uses a four-digit random suffix and `orders.order_number` is globally unique. Under increasing daily volume, collisions create an avoidable failed checkout; the client’s generic duplicate handling may mislabel it as a repeated submission. | Generate a collision-resistant order identifier server-side, or use a server sequence/public display code. Keep idempotency keys as the duplicate-submission control; do not overload order number for it. |
| **M-05** | Address input integrity and error handling are weak | `addresses` fields are only `NOT NULL` at the schema level. The UI accepts arbitrary-length/format phone, hostel, room, and label fields; `ProfilePage` ignores insert/update/delete errors and resets the form regardless. | Add database checks and length limits, validate/normalize at the UI, retain form state on failure, and show safe actionable error messages. Add tests for invalid lengths/formats and failed mutations. |
| **M-06** | App-wide resilience and user-facing failure states are incomplete | The app bootstrap has no error boundary. Several data fetches silently ignore errors, and the lint check reports a missing `useEffect` dependency in address loading. A runtime error or rejected request can leave a blank/stale screen. | Add a global error boundary, loading/error/empty states for every data path, and correct the effect dependencies with stable callbacks. Capture expected failures in frontend tests. |
| **M-07** | Deployment path is not evidenced | The repository provides database governance workflows but no frontend deployment workflow, hosting configuration, release artifact attestation, or documented production URL. Supabase’s optional GitHub integration shows no connected repository. | Select and document a static-hosting path, configure immutable release artifacts and public environment values there, use a real production URL in smoke tests, and ensure the Vite base path `/delivery-app/` matches the selected host. |

### Lower-priority performance and hygiene findings

The live performance advisor identifies missing covering indexes for `addresses.user_id`, `daily_menus.dish_id`, `order_items.dish_id`, and `order_items.order_id`. It also flags duplicate permissive RLS policies accumulated across historical migrations and `auth.uid()` calls that can be wrapped in `SELECT` to avoid per-row re-evaluation. These do not evidence an access-control bypass, but they will create avoidable latency as data grows. [5]

The advisor reports `idx_daily_menus_date_meal` and `idx_orders_user_created` as unused. Because production has no data and very little traffic, that is not a sound basis to drop them; re-evaluate after representative workload exists. The static frontend bundle also needs code splitting before growth: Vite reports a 159.74 kB gzip main bundle and recommends dynamic imports/manual chunks.

The repository includes manual SQL tests that still invoke the retired five-argument `public.create_order` signature. The actual production RPC requires the idempotency key; the maintained JavaScript suites use the correct six-argument interface. Update or retire the stale manual SQL scripts to avoid misleading developers during incident response.

## Supabase advisor findings: disposition

| Advisor category | Current finding | Audit disposition |
| --- | --- | --- |
| Security | `public.create_order`, `public.list_vendor_fulfillment_orders`, and `public.update_vendor_order_fulfillment` are executable `SECURITY DEFINER` functions for `authenticated`. | **Intentional but monitor.** These are explicit API contracts and are guarded by `auth.uid()`/vendor-role checks, fixed search paths, no anonymous execution, and live abuse tests. Keep a documented exception and rerun privilege/RLS suites after every function change. |
| Performance | Four unindexed foreign keys. | **Valid improvement.** Add covering indexes through a forward-only migration after checking actual query patterns. |
| Performance | Multiple permissive policies on addresses/dishes/daily menus/orders/order items. | **Valid cleanup.** Consolidate semantically identical historical policies in a forward-only migration and rerun the policy inventory plus all live RLS suites. |
| Performance | Repeated `auth.uid()` evaluation in RLS policies. | **Valid scale optimization.** Replace with `(select auth.uid())` where policy semantics remain identical, then use `EXPLAIN`/advisor and hosted tests. |

## Current infrastructure and data status

| Environment | Observed status | Important qualification |
| --- | --- | --- |
| Production `xwxjxmbafiguwrqbxgoz` | **Healthy**, nano compute, Mumbai; 21 migrations present. | Has no application rows and no scheduled Supabase backup. The selected manual encrypted logical-backup model remains the documented recovery mechanism. |
| Staging `yuindzemvnnzrtzohbkz` | **Healthy** after restoration. | Suitable for a separately approved next change cycle. |
| Recovery `wuliwrflgjfwnftvkynd` | **Paused**. | It remains distinct from production and staging; resume/reset only through a separately approved recovery activity. |
| Production GitHub environment | Protected reviewer, main-only deployment source, administrator bypass disabled, required secret names present. | Good for manual production workflows; not equivalent to repository branch protection or CI. |

## Recommended next sequence

The next work should be planned as a new post-P0 release-hardening scope; it should not rewrite completed migrations or touch production without separate approval.

1. **Establish a deployable product baseline.** Decide hosting, connect a real production URL, provision the trusted operator role, add approved real menu/catalog data, establish daily menus/hours/fees, and run end-to-end customer/operator acceptance tests.
2. **Restore repository governance.** Add `main` protection/ruleset and an automatic pull-request CI workflow before the next code change.
3. **Upgrade the development/build toolchain.** Resolve the 17 npm audit findings in a branch, beginning with Vite/PostCSS; lock the result and rerun all static and hosted staging checks.
4. **Close checkout business-rule gaps.** Enforce daily-menu eligibility and a customization-array bound in a new migration, then validate on staging before any production migration.
5. **Improve reliability and data quality.** Add an error boundary, robust form errors, server constraints, restaurant-time-zone logic, and a collision-resistant server-generated order reference.
6. **Scale safely.** Consolidate duplicate RLS policies, add verified foreign-key indexes, and optimize `auth.uid()` policies after representative data exists.
7. **Revisit recovery operations.** Continue the approved encrypted-export cadence and off-site retention. A later move to scheduled backup/PITR is a product/operations decision, not an emergency P0 repair.

## Limits of this audit

This review did not send live customer traffic, create production data, inspect secret values, inspect private user records, run destructive SQL, or deploy the frontend. It also did not re-run the live database suites because the recovery project is paused and the current production credentials remain protected; their latest successful evidence is cited instead. The production dashboard’s request counters are only a snapshot and do not establish ongoing monitoring, availability, privacy, accessibility, payment, legal, or product acceptance readiness.

## References

[1]: [Repository main baseline `bd17e42`](https://github.com/gurupavanyadav/Telugu_Adda_Kitchen/tree/bd17e420f7d67d85c339860a7e341d62099f2f41)

[2]: [GitHub Actions — successful encrypted production recovery rehearsal `32875657214`](https://github.com/gurupavanyadav/Telugu_Adda_Kitchen/actions/runs/32875657214)

[3]: [Secure order creation migration](https://github.com/gurupavanyadav/Telugu_Adda_Kitchen/blob/bd17e420f7d67d85c339860a7e341d62099f2f41/delivery-app/supabase/migrations/20260816000002_secure_create_order_rpc.sql) and [live RLS suite](https://github.com/gurupavanyadav/Telugu_Adda_Kitchen/blob/bd17e420f7d67d85c339860a7e341d62099f2f41/delivery-app/scripts/test-rls.mjs)

[4]: [Supabase database linter — SECURITY DEFINER callable by authenticated users](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)

[5]: [Supabase RLS performance guidance](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) and [database linter guidance](https://supabase.com/docs/guides/database/database-linter)

[6]: [GitHub Actions security hardening guidance](https://docs.github.com/actions/security-for-github-actions/security-guides/security-hardening-your-deployments)

[7]: [GitHub branch-rules documentation](https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)

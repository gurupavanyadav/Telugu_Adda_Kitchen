# Telugu Adda Kitchen

**Telugu Adda Kitchen** is a React/Vite restaurant-ordering frontend backed by Supabase Auth, Postgres, Row Level Security (RLS), and server-authoritative PostgreSQL RPCs. It is designed for the confirmed **single trusted restaurant-operator** model: customers can browse a daily menu, maintain their own delivery addresses, and place cash-on-delivery or pickup orders; the trusted operator receives only the fulfillment data needed to prepare and deliver orders.

> **Current position — 25 August 2026:** The agreed **P0 database security, production governance, and recovery-rehearsal controls are complete**. This repository is **not yet an unqualified public-launch-ready product**: production has no application data, no frontend hosting/release path is documented here, and post-P0 engineering/governance work remains. Read the status sections before treating this project as a live restaurant service. [1] [2]

## Contents

| Section | Purpose |
| --- | --- |
| [Project status](#project-status) | Distinguish P0 closure from public-launch readiness. |
| [Architecture and security model](#architecture-and-security-model) | Explain the trust boundaries and intended data flow. |
| [Repository map](#repository-map) | Locate the application, migrations, tests, workflows, and evidence. |
| [Local development](#local-development) | Build and validate safely without committing secrets. |
| [Database and release operations](#database-and-release-operations) | Use the protected migration path and forward-only correction policy. |
| [Backup and recovery](#backup-and-recovery) | Understand the approved Free-tier encrypted logical-export model. |
| [Production readiness work](#production-readiness-work-still-open) | See the current post-P0 public-launch blockers. |

## Project status

The table below is deliberately precise. A passed P0 control does not imply that all future P1, business, product, privacy, accessibility, observability, or deployment work has been completed.

| Control area | Status | Evidence and qualification |
| --- | --- | --- |
| Immutable migration baseline | **Pass** | Production contains the expected 21 migrations, including `20260825000000_revoke_handle_new_user_execute`. The local checksum manifest verifies the same 21 migration artifacts. |
| Production authorization controls | **Pass** | Protected production runs applied the migrations and Auth-trigger execution fix, then passed production RLS, checkout, and address verification. [3] [4] |
| Production recovery rehearsal | **Pass** | The separately approved encrypted logical export and isolated Supabase restore rehearsal passed migration, relation, policy/grant, RLS **13/13**, checkout **6/6**, and address-RLS **6/6** checks. [5] |
| Current production platform state | **Healthy but empty** | The Supabase project is healthy and has the expected schema, but the current application tables have zero rows. It needs real operational data before customers can order. [1] |
| Staging state | **Healthy** | Staging was restored after the final recovery rehearsal. |
| Recovery project state | **Paused** | The isolated recovery project is paused to remain within the Free-tier active-project limit. It must never be confused with production or staging. |
| Public product launch | **No-go today** | Catalog/menu/operator setup, hosting, automated CI, branch controls, build-tool upgrades, business-rule hardening, and broader acceptance work remain open. [2] |

## Architecture and security model

### Application components

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Customer and operator UI | React 18, TypeScript, Vite, Tailwind CSS | Menu browsing, account flows, cart, checkout, address management, order tracking, and vendor fulfillment UI. |
| Client data access | `@supabase/supabase-js` | Uses only the public Supabase URL and publishable/anonymous key. Browser code must never contain a service-role key, database password, access token, or backup passphrase. |
| Authentication | Supabase Auth | Handles sign-up, sign-in, session persistence, and session refresh. |
| Database authorization | Postgres RLS, table grants, guarded RPCs, trigger checks | Enforces customer ownership, vendor role checks, order immutability, and constrained fulfillment transitions. |
| Checkout authority | `public.create_order(...)` and `private.internal_create_order(...)` | The server derives catalog names, pricing, customizations, totals, fee, address snapshot, and initial status; the client sends intent only. |
| Operations | GitHub Actions plus protected environments | Runs protected migrations, live authorization verification, and encrypted recovery rehearsal. |

### Checkout trust boundary

The browser must be treated as untrusted. The checkout UI can display estimated item totals and delivery fees, but the database is authoritative. The final order RPC performs the following checks before persisting an order:

| Client input | Server-side handling |
| --- | --- |
| Order number and idempotency key | Validates required format/length, serializes a per-user idempotency key, replays an identical request safely, and rejects conflicting reuse. |
| Fulfillment type and address ID | Requires an owned address for delivery; forbids an address for pickup; stores a server-selected address snapshot. |
| Dish IDs and quantities | Loads the dish catalog, requires available dishes, and applies quantity and total-item limits. |
| Customizations | Checks selection shape and labels against the catalog, derives the catalog prices, rejects duplicates and unknown options. |
| Names, prices, fees, and totals | Does not trust browser values. It derives all persisted monetary and snapshot values from server-side state. |
| Order status | Starts at `received`; customer direct writes are blocked and vendor transitions are constrained. |

### Roles and privacy boundary

| Principal | Permitted behavior | Explicitly restricted behavior |
| --- | --- | --- |
| Anonymous visitor | Browse public menu/catalog data where RLS allows it. | Cannot access addresses, orders, order items, user roles, or checkout RPC. |
| Customer | Read own orders/order items, manage own addresses, and create orders through the guarded RPC. | Cannot read another customer’s data, write order totals/status directly, modify order items, create roles, or use another user’s delivery address. |
| Trusted restaurant operator (`vendor`) | Manage catalog availability and use the fulfillment RPCs. | Cannot directly read raw orders/order-item pricing or customer IDs; fulfillment responses intentionally omit totals/prices/customer IDs. |
| Service role | Operational fixture, maintenance, and protected workflow capability only. | Must remain in protected environment secrets and must never be placed in browser code or a `VITE_*` variable. |

The vendor fulfillment functions are intentionally `SECURITY DEFINER` because direct raw-table access is deliberately denied. They use a fixed search path and server-side vendor-role checks. Supabase’s linter reports that authenticated users can invoke the functions; this is expected for the explicit API contract, but each function change must be treated as security-sensitive and revalidated with the policy/grant inventory and live suites. [6]

## Repository map

| Path | Description |
| --- | --- |
| `delivery-app/src/` | React frontend source. Feature folders include authentication, menu, cart, checkout, profile/address management, orders, and trusted-operator views. |
| `delivery-app/src/lib/supabase.ts` | Fail-fast public Supabase configuration and shared application types. |
| `delivery-app/src/features/checkout/api/orderClient.ts` | Client wrapper around the guarded `create_order` RPC and safe customer-facing error mapping. |
| `delivery-app/supabase/migrations/` | The 21 immutable, ordered database migrations. **Never edit an applied migration.** Create a new forward-only migration for every change. |
| `delivery-app/supabase/verification/` | Immutable migration checksum manifest and hosted policy/grant inventory. |
| `delivery-app/scripts/` | Configuration, migration-manifest, Auth trigger, RLS, checkout, and address RLS test suites. |
| `.github/workflows/` | Guarded staging/production migration, production live verification, and encrypted recovery-rehearsal workflows. |
| `delivery-app/supabase-migration-release-procedure.md` | Detailed protected migration, verification, and forward-fix procedure. |
| `delivery-app/delivery-app-p0-closure-p1-verification-report.md` | Completed encrypted logical-recovery rehearsal evidence, custody status, and Free-tier residual-risk record. |
| `delivery-app/vendor-fulfillment-data-boundary.md` | Approved single-operator vendor data-minimization contract. |
| `delivery-app/delivery-app-p0-closure-p1-verification-report.md` | Final P0 closure record and scope boundary. |
| `reports/` | Security, code-review, pentest, storage, launch-readiness, and latest deep-audit reports. |

## Local development

### Prerequisites

Use Node.js 22 or a compatible current Node.js version and npm. The repository uses `package-lock.json`; install dependencies with `npm ci`, not a loose package install.

The app requires two browser-public Supabase settings:

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-or-anon-key>
```

Place them only in a local untracked `.env.local` file for development. They are public browser configuration, not privileged credentials. **Never** put a service-role key, Supabase access token, database password, recovery connection string, or backup passphrase in `.env.local`, source code, documentation, screenshots, browser chat, or a `VITE_*` variable.

### Run locally

```bash
cd delivery-app
npm ci
npm run dev
```

The production build is intentionally fail-closed: it will refuse to build unless `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present, valid, non-placeholder values. This prevents an accidental release with a hard-coded fallback or missing backend configuration.

### Static checks

Run the following before proposing a database or frontend change:

```bash
cd delivery-app
npm run verify:migrations
npm run test:supabase-config
npm run typecheck
npm run lint
npm run audit:prod
```

| Command | What it proves |
| --- | --- |
| `npm run verify:migrations` | All 21 migration files match `supabase/verification/migration-checksums.sha256`. |
| `npm run test:supabase-config` | Production builds fail without valid public configuration and accept only explicit valid configuration. |
| `npm run typecheck` | TypeScript compilation is sound. |
| `npm run lint` | Checks client-code quality. Resolve warnings before release-grade work. |
| `npm run audit:prod` | Checks runtime/browser dependency exposure while omitting development dependencies. |

### Live authorization suites

The following tests create and clean up disposable fixtures. They require an approved non-production or isolated recovery target and protected test credentials:

```bash
npm run test:auth-profile-trigger
npm run test:rls
npm run test:checkout
npm run test:address-rls
```

Do **not** run live suites against production manually. Use the guarded workflow and its protected environment only after separate approval. Do not send test keys in chat.

## Database and release operations

### Non-negotiable migration rules

> **Applied migration files are immutable.** If a migration has reached staging or production, never edit, rename, delete, or reorder it. Every correction must be a new, forward-only migration with a corresponding checksum-manifest update and validation evidence.

The production baseline currently ends at:

```text
20260825000000_revoke_handle_new_user_execute.sql
```

This forward-only migration removes direct client-facing execution of the Auth profile trigger helper while preserving trigger operation. The hosted policy/grant inventory fails if the unsafe grant returns.

### Protected workflow model

All repository workflows are intentionally manual at present and require an exact confirmation phrase. Production workflows additionally target the protected `production` GitHub environment.

| Workflow | Purpose | Safety boundary |
| --- | --- | --- |
| `production-apply-p0-migrations.yml` | Historical P0 migration deployment evidence. | Production environment, immutable-manifest verification, exact project-ref guard, explicit confirmation. |
| `production-apply-handle-new-user-forward-fix.yml` | Historical forward-only Auth-trigger grant remediation. | Production environment, staging-validated migration, hosted inventory. |
| `production-live-p0-verification.yml` | Historical production RLS/checkout/address verification. | Production environment, fixed target guard, isolated fixture cleanup, retained evidence. |
| `production-free-tier-recovery-rehearsal.yml` | Encrypted logical export and isolated restoration rehearsal. | Production read-only export, separate recovery target, checksum verification, runner plaintext cleanup. |
| `staging-*.yml` | Staging validation and historical migration-control workflows. | Staging environment only. |

The production environment is configured with a required reviewer, a `main`-only deployment source, and administrator bypass disabled. These controls protect manual deployment workflows. They do **not** replace a repository `main` branch protection/ruleset or automatic pull-request CI; those remain post-P0 work. [2] [7]

### Before any new database change

1. Create a new migration; do not edit historical migrations.
2. Add or adjust a focused regression test that demonstrates the defect and expected corrected behavior.
3. Regenerate and verify the migration checksum manifest.
4. Run static checks locally.
5. Use staging first through a separately approved protected workflow.
6. Inspect hosted policy/grant inventory and live suite outputs.
7. Obtain a new, separate approval before any production migration or production live test.
8. If production needs correction, use a forward-only migration and preserve evidence.

For complete operating detail, read `delivery-app/supabase-migration-release-procedure.md` before changing hosted schema state.

## Backup and recovery

### Approved Free-tier recovery model

The current recovery design is an **encrypted logical export**, not automatic continuous backup or point-in-time recovery. It consists of role, schema, data, and migration-history dumps; an AES-256 encrypted bundle; a checksum manifest; a separate empty Supabase recovery target; and recovered-target policy/RLS/checkout/address validation.

The final approved rehearsal succeeded in GitHub run [`32875657214`](https://github.com/gurupavanyadav/Telugu_Adda_Kitchen/actions/runs/32875657214). It completed an end-to-end recovery in an observed **4 minutes 23 seconds**, including encryption/decryption, checksum verification, isolated restore, 21-migration verification, six core relation checks, policy/grant checks, RLS **13/13**, checkout **6/6**, and address RLS **6/6**. This is an observed rehearsal duration, not a contractual recovery-time objective. [5]

### Recovery safety rules

| Rule | Reason |
| --- | --- |
| Never restore into production or staging. | The rehearsal target must be a distinct, separately approved Supabase project. |
| Never reset, pause, delete, or overwrite production. | Production is the protected source of truth. |
| Require separate confirmation for every export, restore, reset, pause, delete, or production test. | Previous approval does not authorize a later operation. |
| Keep encrypted archives off-site. | GitHub evidence artifacts expire after 90 days and are not the sole long-term recovery copy. |
| Keep the passphrase only in a password manager or secure vault. | The passphrase must never enter source, logs, screenshots, issues, or chat. |
| Preserve plaintext cleanup. | Export and restore runners must remove plaintext exports, decrypted bundles, and extracted files before job completion. |

The recovery project is currently paused and staging is healthy. Resume or reset the recovery project only for a separately approved future rehearsal.

## Production readiness work still open

The following items are not a revision of the P0 closure decision; they are current public-launch hardening work identified by the latest deep audit. They should be planned and approved as a new scope.

| Priority | Work item | Why it matters |
| --- | --- | --- |
| High | Provision the real trusted operator role, catalog, daily menus, opening hours, fees, and delivery settings in production. | Production currently has no application data, so customers cannot use the intended service. |
| High | Choose and document a frontend hosting/release path with a real production URL. | This repository does not currently evidence a static-site deployment workflow or application smoke test. |
| High | Add `main` branch protection/ruleset and automatic pull-request CI. | All current workflows are manual-only; no branch rule currently requires review or validation before merge. |
| High | Enable Dependabot alerts/security updates, code scanning, a security policy, and a private vulnerability-reporting path as appropriate. | Repository security automation is incomplete. |
| High | Upgrade Vite/PostCSS and the lockfile under controlled validation. | The production-only audit is clean, but the complete dependency audit reports development/build-tool vulnerabilities. |
| Medium | Enforce daily-menu eligibility in the checkout RPC. | The UI displays daily menus, but the final checkout RPC currently checks dish availability rather than today’s menu membership. |
| Medium | Add a maximum customization count and an explicit regression test. | Current server validation checks customization shape and labels but does not impose an explicit per-item array bound. |
| Medium | Make restaurant time-zone/business-date logic server-authoritative. | Current menu date uses UTC while meal selection uses browser-local time. |
| Medium | Generate collision-resistant order identifiers on the server. | The browser currently generates a daily order number with only a four-digit random suffix. |
| Medium | Add address schema validation, robust form errors, and an app-wide error boundary. | Current UI resilience and address data-quality enforcement need improvement. |
| Medium | Add forward-only foreign-key indexes and consolidate duplicate RLS policies after workload review. | Supabase performance advisors identify unindexed foreign keys and cumulative policy overhead. |

## Important limitations

The repository currently has no payment gateway, no public deployment workflow, no continuous backup/PITR, no automated scheduled tests, and no complete public-launch acceptance record for privacy, accessibility, observability, incident ownership, restaurant operations, or legal/support policies. Do not infer those capabilities from a successful P0 security/recovery rehearsal.

The status of production data is especially important. The schema is healthy but empty: a database migration and a secured UI are not the same thing as a launchable restaurant operation. Add only approved real operational data through a separately planned and validated process.

## Key documents

| Document | Read when |
| --- | --- |
| [`delivery-app/delivery-app-p0-closure-p1-verification-report.md`](./delivery-app/delivery-app-p0-closure-p1-verification-report.md) | You need the final P0 closure record and exact scope boundary. |
| [`reports/telugu-adda-kitchen-deep-audit-status-2026-08-25.md`](./reports/telugu-adda-kitchen-deep-audit-status-2026-08-25.md) | You need the latest detailed code audit, live advisor findings, and public-launch status. |
| [`delivery-app/supabase-migration-release-procedure.md`](./delivery-app/supabase-migration-release-procedure.md) | You are preparing a staging or production database change. |
| [`delivery-app/delivery-app-p0-closure-p1-verification-report.md`](./delivery-app/delivery-app-p0-closure-p1-verification-report.md) | You need the completed encrypted recovery-rehearsal evidence, archive-custody status, or Free-tier residual-risk record. |
| [`delivery-app/vendor-fulfillment-data-boundary.md`](./delivery-app/vendor-fulfillment-data-boundary.md) | You are changing vendor/operator data access or considering a multi-operator model. |
| [`delivery-app/rls-incident-response-playbook.md`](./delivery-app/rls-incident-response-playbook.md) | You suspect RLS bypass, unauthorized order modifications, or other database-security incidents. |

## References

[1]: [`reports/telugu-adda-kitchen-deep-audit-status-2026-08-25.md`](./reports/telugu-adda-kitchen-deep-audit-status-2026-08-25.md) — latest code audit and observed project status.

[2]: [`audit-external-evidence-2026-08-25.md`](./audit-external-evidence-2026-08-25.md) — browser-observed GitHub/Supabase project, security, and environment evidence.

[3]: [GitHub Actions — production P0 migration `32836755375`](https://github.com/gurupavanyadav/Telugu_Adda_Kitchen/actions/runs/32836755375).

[4]: [GitHub Actions — production live P0 verification `32851577643`](https://github.com/gurupavanyadav/Telugu_Adda_Kitchen/actions/runs/32851577643).

[5]: [GitHub Actions — encrypted production recovery rehearsal `32875657214`](https://github.com/gurupavanyadav/Telugu_Adda_Kitchen/actions/runs/32875657214).

[6]: [Supabase database linter guidance — authenticated SECURITY DEFINER functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

[7]: [GitHub branch rules documentation](https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets).

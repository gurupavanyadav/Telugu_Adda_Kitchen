# Delivery App Launch-Readiness Review

**Review scope.** This assessment consolidates the reviewed React/Vite frontend, Supabase schema and migration chain, RLS and RPC hardening work, checkout and order flows, Storage configuration, CI/CD workflows, automated security tests, and operational controls. It is a source-and-configuration review supplemented by local type-check, lint, production-build, dependency-audit, and static policy checks. It is **not** a production penetration test, payment certification, accessibility certification, or live disaster-recovery test.

> **Executive decision: No-go for a public launch until the P0/P1 items are closed and the full migration-plus-integration suite passes against a production-like Supabase project.**

The current implementation has a solid security direction: pricing and delivery snapshots are being moved to server-side calculation; customer order writes are being removed; vendor updates are being narrowed; address ownership and role-source consolidation have been addressed in follow-up migrations; and RLS regression suites exist. However, launch readiness depends on those migrations actually being applied in the correct order, the hosted Supabase project matching the repository, and the end-to-end test workflows running successfully rather than only passing static checks.

## 1. Executive launch scorecard

| Area | Current assessment | Launch decision | Required evidence |
| --- | --- | --- | --- |
| Authentication | Basic email/password flow works, but onboarding, recovery, error handling, and abuse controls are incomplete | **No-go until P1s close** | Verified email-confirmation path, password reset, rate limiting, safe errors, session tests |
| Authorization and RLS | Stronger than the initial state, but migration drift and role semantics remain operational risks | **No-go until P0/P1s close** | Fresh database reset, hosted migration diff, authenticated RLS suite, policy inventory |
| Order integrity | Server-calculated RPC and status allowlist are the right architecture | **Conditional** | Replay/idempotency decision, concurrency tests, authoritative-total UI, RPC integration tests |
| Customer data privacy | Address ownership is intended to be isolated; vendor visibility is broad | **Conditional** | Explicit vendor data-visibility decision, privacy review, address RLS tests |
| Storage | No repository-controlled bucket or object-policy inventory was found | **No-go if uploads are in scope** | Bucket inventory, private-by-default policy, upload tests, S3 credential review |
| CI/CD and migrations | Static checks pass, but live Supabase execution was unavailable in the sandbox | **No-go until CI evidence exists** | Green GitHub Actions run from a clean database and protected deployment branch |
| Reliability and support | Several silent-error and polling paths exist; no complete observability evidence was found | **No-go for broad launch** | Error monitoring, alerts, runbooks, synthetic checkout, support workflow |
| Accessibility and UX | Functional UI is present, but keyboard, screen-reader, error, and loading behavior need a formal pass | **No-go until acceptance pass** | WCAG-oriented manual and automated test results |
| Dependency/security hygiene | `npm audit --omit=dev` reports one high `ws` vulnerability | **No-go until resolved or formally accepted** | Updated lockfile, audit result, dependency exception if unavoidable |

## 2. P0 launch blockers

### P0-01 — Prove the hosted database is on the hardened migration state

The repository contains a long migration chain with historical permissive policies and subsequent hardening migrations. A fresh local reset is not enough: the exact hosted Supabase project must be compared against the repository and the latest migrations must be applied in order. The relevant security changes include the hardened order RPC, removal of direct customer order writes, vendor update restrictions, the secure minimal RPC wrapper, SEC-P01/SEC-P03 hardening, and removal of legacy admin RLS policies.

**Risk.** If any follow-up migration is absent from production, an authenticated customer may retain direct order mutation paths, a legacy admin predicate may expose addresses, or the old client/RPC contract may remain active.

**Required fix and evidence.** Run a clean `supabase db reset` in CI, run the full authenticated RLS, checkout, address, and privilege-escalation suites, compare hosted migration history, and run a policy/grant inventory query in a protected environment. Block deployment when a migration is missing or when any forbidden policy name or broad grant exists.

### P0-02 — Remove silent production-project fallback from the Supabase client

`src/lib/supabase.ts` falls back to a real Supabase URL and an embedded anon key when `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is absent. The anon key is not a service-role secret, but a real-project fallback is still unsafe operational behavior: a misconfigured build can silently point at the wrong environment, and a build artifact can be mistaken for a correctly configured release.

**Required fix.** Fail fast in production when the public environment variables are missing or malformed. Permit a clearly isolated local-development fallback only behind an explicit development condition. Add a CI assertion that the production build contains the intended project reference and never uses a fallback. Rotate the anon key if the project treats the current value as compromised, and do not place any service-role key in frontend code or Vite-exposed variables.

### P0-03 — Resolve the high dependency vulnerability and establish a dependency exception process

`npm audit --audit-level=moderate --omit=dev` reports one high-severity vulnerability in `ws`, involving uninitialized-memory disclosure and memory-exhaustion denial of service. The vulnerable package is transitive, so the parent dependency and lockfile path must be upgraded rather than blindly suppressing the result.

**Required fix.** Upgrade the parent dependency or apply the lockfile remediation, rerun the audit, run the complete build and integration suites, and document any unavoidable exception with owner, expiry, exploitability analysis, and compensating controls. Add automated dependency review, lockfile-only update checks, and an SBOM or equivalent release artifact.

### P0-04 — Decide whether vendor visibility of all customer orders is acceptable

The current vendor-facing order-read model permits a vendor role to see operational orders and delivery snapshots across customers. This is acceptable only for a single trusted restaurant operator with a documented business need. It is not acceptable for a multi-vendor platform or for least-privilege operations.

**Required fix.** Either document and approve the single-operator model, minimize displayed PII, and audit vendor access, or introduce a vendor/restaurant tenant key and scope every catalog, order, and address read to that tenant. Prefer a narrow operational RPC that returns only fields required to fulfill an order instead of exposing the complete order row and delivery snapshot.

### P0-05 — Establish production migration, rollback, and backup procedures

The reviewed deployment workflow is primarily a static GitHub Pages deployment. A green frontend deploy does not prove that Supabase migrations were applied, nor does it provide rollback evidence. The application needs a protected migration job, staging promotion, backup verification, and a tested rollback/forward-fix procedure.

**Required fix.** Add a migration pipeline with protected production environment approval, immutable migration artifacts, pre-migration backup or recovery-point verification, post-migration policy smoke tests, and an explicit forward-fix strategy. Never run destructive SQL automatically against production without a review gate and a tested backup.

## 3. P1 security and integrity findings

### P1-01 — Add database-level idempotency for order placement

The UI disables the submission button while the request is in flight, but this does not protect against refreshes, retries, network timeouts, double tabs, browser replay, or a client that intentionally sends the request repeatedly. A unique `order_number` prevents exact duplicate identifiers but does not prevent a second order with a new client-generated identifier.

**Recommended design.** Generate an idempotency key per intended checkout attempt, pass it to the server, store it with the order, and enforce a unique constraint on `(user_id, idempotency_key)`. The RPC should return the existing order for a repeated key when the original request succeeded, or a deterministic conflict when payloads differ. Add concurrency tests with two simultaneous requests.

### P1-02 — Replace client-generated order numbers with server-generated identifiers

The current client-side order-number generation is predictable and couples user-visible identifiers to retry behavior. Use a server-generated UUID as the primary identifier and generate a short display number inside the trusted database transaction. Make the display number unique and non-sensitive; never use it as an authorization credential.

### P1-03 — Close the role-model and admin UI gap

The canonical role migration recognizes `vendor` and `admin`, but the frontend auth type currently models only `vendor | customer` and maps every non-vendor result to `customer`. If administrators are expected to use an administrative console, their role will be silently downgraded in the UI. If admins are intentionally service-only, remove the unused UI expectation and document that policy.

**Required fix.** Define the supported role enum once, return role-loading failures distinctly from an ordinary customer role, add server-side role tests, and provide a separate admin UI gate only if product requirements need it. Never use the legacy `profiles.role` field for authorization.

### P1-04 — Add explicit authorization tests for every privileged action

Existing RLS tests cover many important cases, but launch should include a matrix for customer, vendor, admin/service, anonymous, and expired-session callers against every table and RPC. Include negative tests for role insertion, role changes, catalog mutation, order status, protected totals, address access, and direct object access.

### P1-05 — Harden the Storage posture before enabling uploads

No repository-controlled bucket definitions, `storage.objects` policies, upload helpers, or Storage-specific CI tests were found. This is safe only if the product truly has no file-upload requirement and hosted buckets are absent. If uploads are in scope, this is a launch blocker: bucket visibility, object ownership paths, MIME restrictions, size limits, signed URL lifetime, deletion, and S3-compatible credentials must be defined as code and tested.

**Required fix.** Use private buckets by default, scope object names to the authenticated subject or tenant, deny cross-user reads and deletes, validate MIME and size on both client and server, use short-lived signed URLs, and keep S3 access keys outside the browser. Add Storage policy tests and a hosted bucket inventory check.

### P1-06 — Add abuse controls around authentication and checkout

The application has basic email/password auth and an authenticated checkout, but there is no evidence of production rate limiting, CAPTCHA or bot controls, failed-login alerting, account lockout policy, checkout throttling, or abuse detection. Implement controls appropriate to expected traffic and threat model, preferably at Supabase/Auth and edge/WAF layers rather than only in React.

### P1-07 — Avoid returning raw database/auth errors to users

Several pages and auth methods surface backend error messages directly. These can reveal internal policy, constraint, function, or schema details and create inconsistent UX. Map known errors to stable user-facing codes/messages, log the detailed error server-side with a correlation ID, and do not expose SQL or policy names.

### P1-08 — Add audit logging for role and order changes

The system needs an append-only audit record for role grants/removals, order status transitions, protected-field update attempts, RPC failures, and privileged reads. Record actor, target, timestamp, action, outcome, request/correlation ID, and a minimal before/after summary without copying unnecessary PII.

## 4. P2 application and functional defects

| ID | Area | Finding | Recommended change |
| --- | --- | --- | --- |
| P2-01 | Checkout | The cart shows a delivery fee and grand total before fulfillment selection, while the server later calculates the authoritative fee. | Show a clearly provisional cart estimate and refresh the authoritative summary after fulfillment selection and order creation. |
| P2-02 | Checkout | The client cart retains dish prices and customization prices that can become stale while the server correctly recalculates them. | Mark client prices as display-only, refresh catalog data before checkout where practical, and always render the server result as authoritative. |
| P2-03 | Checkout | Retry after a timeout can create duplicate orders unless idempotency is added. | Implement P1-01 before launch. |
| P2-04 | Checkout | No explicit confirmation/review step is evident before the final placement action. | Add a review screen or a clear irreversible-action confirmation containing fulfillment, address, items, and total. |
| P2-05 | Checkout | Delivery address is required for delivery, but field validation is mostly presence-only. | Add length, character, phone normalization/validation, and server-side constraints. |
| P2-06 | Menu | The menu query uses `new Date().toISOString()` while the display uses local time. Around midnight, the UI can show one date while querying another. | Define the restaurant timezone and calculate the business date consistently on client and server. Prefer a server-provided current business date. |
| P2-07 | Menu | A dish detail path can allow an unavailable item to reach the cart; the RPC should reject it, but the UI should prevent the misleading action. | Disable add-to-cart for unavailable dishes and show the reason. Keep the RPC check as the authoritative control. |
| P2-08 | Menu | Menu-load errors are treated like an empty menu. | Distinguish loading, empty, and failed states with retry and support guidance. |
| P2-09 | Cart | Cart state is in memory only; browser refresh or tab closure loses the cart. | Decide whether persistence is required, then persist only non-sensitive intent data with a schema/version and revalidate it on restore. |
| P2-10 | Cart | Customization merge keys use sorted labels and ignore prices/option IDs. Duplicate labels or changed options can merge distinct items. | Use stable customization IDs plus canonical values in the cart key; never use display labels as identity. |
| P2-11 | Cart | Quantity values have no meaningful client maximum and can grow until the server rejects them. | Add visible per-item and total-quantity limits and keep server limits authoritative. |
| P2-12 | Profile | Save, update, delete, and address-load errors are ignored; the form resets even when a write fails. | Check every response, preserve input on failure, show a retryable message, and disable destructive actions while pending. |
| P2-13 | Profile | Delete address has no confirmation or undo. | Add confirmation and prevent deleting an address referenced by an active checkout; handle the database response explicitly. |
| P2-14 | Orders | Order history loads all orders and nested items without pagination or a hard limit. | Add server-side pagination, bounded page sizes, selected columns, and a count/continuation strategy. |
| P2-15 | Tracking | Tracking polls every five seconds indefinitely, without aborting in-flight requests, pausing when hidden, backoff, or a terminal-state stop. | Stop polling on delivered/cancelled, use visibility-aware backoff or Supabase Realtime, and discard stale responses. |
| P2-16 | Tracking | Confirmation and tracking perform separate order and item requests, increasing latency and partial-failure states. | Add a scoped read RPC/view or handle order/item loading independently with retry. |
| P2-17 | Tracking | Customer-visible delivery address includes a phone number. | Minimize or mask PII where operationally possible and document vendor/customer access. |
| P2-18 | Vendor dashboard | Privileged mutations need explicit pending state, response checking, and idempotent status actions. | Disable duplicate actions, display safe errors, and refresh from the server after each transition. |
| P2-19 | Vendor dashboard | “Add Dish (Coming Soon)” is visible in a launch build. | Remove it, hide it behind a feature flag, or implement the feature before launch. |
| P2-20 | Admin/vendor | The role label and dashboard terminology have evolved from admin to vendor. | Finalize product language, navigation, and permissions; test every role in a clean browser session. |
| P2-21 | Database | No explicit application indexes were found for common filters and joins. | Add indexes on `orders(user_id, created_at)`, `order_items(order_id)`, `addresses(user_id, created_at)`, `user_roles(user_id)`, `daily_menus(menu_date, meal_type)`, and relevant catalog foreign keys after measuring query plans. |
| P2-22 | Database | Several text and numeric fields lack clear length, non-negative, or domain constraints. | Add constraints for prices/fees, phone and room lengths, notes, names, URL shape, and customization JSON shape; validate in RPCs and UI. |
| P2-23 | Database | Historical policy definitions remain in the migration chain and must not be mistaken for current effective state. | Keep migrations immutable, add explicit cleanup migrations, and test effective `pg_policies`, grants, and function privileges after a clean reset. |
| P2-24 | Database | No retention or deletion policy was evidenced for addresses, order snapshots, or operational logs. | Define legal/business retention, account deletion behavior, anonymization, and backup-retention handling before collecting real customer data. |
| P2-25 | Database | Money uses numeric values but no documented currency/rounding contract was found. | Define currency, scale, rounding mode, tax/fee policy, and format all server-side totals consistently. |
| P2-26 | Database | Fixed delivery fee is represented in application/database logic. | Move operational pricing to a versioned configuration table or server-side policy with effective dates and audit history. |

## 5. P2 authentication and account-management gaps

The signup page validates only a six-character minimum and password matching. It has no password-strength guidance, no terms/privacy acceptance, and no explicit email-confirmation state. If Supabase email confirmation is enabled, redirecting immediately to the home page can make an unverified signup appear complete. Add a pending-verification screen, resend-verification flow, password reset, and clear recovery handling before launch.

Sign-in and sign-up display raw backend errors. Normalize messages such as invalid credentials, rate limits, duplicate email, and unconfirmed email without confirming whether an account exists. Add rate-limited login telemetry, suspicious-login alerts where appropriate, and a documented account-recovery process. Consider MFA for privileged vendor/admin accounts even if customers remain password-only.

The authentication provider silently defaults a role-loading failure to `customer`. This is safer than granting privilege, but it can hide an outage and leave a vendor without access. Expose a distinct degraded-auth state, log it with a correlation ID, and provide a retry path. Confirm that auth-state changes, refresh-token rotation, sign-out, and deep-link recovery are tested across reloads and multiple tabs.

## 6. P2 accessibility, content, and privacy gaps

The following should be completed before a broad public launch:

- Add accessible names to icon-only controls, particularly close, edit, delete, add, and menu controls.

- Associate visible form labels with inputs through `htmlFor`/`id`; do not rely only on visual adjacency.

- Ensure all menus, dialogs, carts, and error messages work with keyboard navigation and screen readers.

- Add focus management for the cart drawer, dialogs, navigation changes, and validation errors.

- Respect reduced-motion preferences; current animated loaders and transitions should not be mandatory for users who request reduced motion.

- Verify color contrast for status chips, muted text, disabled buttons, and the decorative palette.

- Avoid nested interactive controls such as a clickable dish card containing a separate button unless the semantics are made accessible.

- Test at mobile widths, zoom 200%, large text, slow network, offline/reconnect, and keyboard-only navigation.

- Replace or self-host critical hero imagery and fonts where appropriate; current Pexels and Google Fonts dependencies create privacy, availability, and performance coupling.

- Replace static “Open Now” and operating claims with data-driven status, timezone-aware hours, and a closed/unavailable state.

- Add privacy policy, terms, refund/cancellation policy, support contact, data deletion request path, and clear address/phone data-use notice.

- Define whether phone numbers are shown to vendors, masked in the customer UI, and retained in order snapshots.

These recommendations align with the principle of treating accessibility as a release requirement rather than a cosmetic enhancement; use [WCAG 2.2](https://www.w3.org/TR/WCAG22/) as the acceptance baseline.

## 7. P2 reliability, observability, and operations

No complete centralized error-monitoring, alerting, audit-log, or synthetic-transaction setup was evidenced. Before launch, instrument frontend exceptions, auth failures, RPC failures, rejected RLS attempts, order-state transitions, and deployment/migration failures. Include a request or correlation ID in safe user messages and logs, but never log passwords, auth tokens, service-role keys, complete payment data, or unnecessary address/phone values.

Create dashboards and alerts for order-creation error rate, time-to-status-transition, stuck `received` orders, checkout abandonment, database latency, Auth failures, storage policy violations, and CI/migration failures. Establish an on-call owner, escalation policy, support response targets, and the incident playbook already produced for this project.

Test backup restoration using a fresh environment, not only backup creation. Record recovery point objective and recovery time objective, verify Supabase project ownership and billing/limits, and document what happens when quotas, email delivery, database connections, or image hosts fail.

## 8. CI/CD and supply-chain hardening

The current quality gates are a good foundation, but launch should add the following controls:

1. Run the RLS, checkout, address, privilege-escalation, and Storage suites from a clean database on every migration/RLS/checkout change.

1. Enforce the reusable security workflow as a required branch-protection check; do not rely only on workflow ordering.

1. Add dependency review, `npm audit` or an approved scanner, secret scanning, and a lockfile integrity check.

1. Pin third-party GitHub Actions to immutable commit SHAs where the organization’s threat model requires it; at minimum, pin major versions and review updates.

1. Add a production build smoke test that checks the correct Supabase URL, rejects missing environment variables, and verifies the deployed base path.

1. Build a preview environment with isolated Supabase credentials; never run integration tests against production.

1. Protect production secrets and environments with reviewer approval; separate development, staging, and production projects.

1. Generate a release artifact containing commit SHA, migration version, dependency lockfile hash, build metadata, and test results.

1. Add a migration-drift check against the target project and fail if policies/grants differ from the reviewed baseline.

1. Add a rollback or forward-fix runbook and rehearse it before launch.

The current lint output has four warnings, including a missing `useEffect` dependency in `ProfilePage.tsx` and Fast Refresh export warnings in contexts. These are not necessarily security vulnerabilities, but they should be resolved or explicitly accepted before launch. The TypeScript version is outside the officially supported range advertised by the installed `@typescript-eslint/typescript-estree`, so align the versions to remove avoidable tooling risk. Browserslist also reports outdated `caniuse-lite`; update it as part of the release maintenance pass.

## 9. Minor but real defects to fix

| ID | Defect | Why it matters |
| --- | --- | --- |
| M-01 | Favicon remains the Vite starter icon and uses an absolute root path | Broken branding/icon under the GitHub Pages base path |
| M-02 | Base path is tied to a repository-name assumption | A rename, custom domain, or alternate preview path can break assets/routes |
| M-03 | No explicit global error boundary | A render-time exception can blank the entire app with no recovery UI |
| M-04 | No request cancellation on route changes | Slow responses can update unmounted or stale screens and waste network/database capacity |
| M-05 | Several data-load failures become empty states | Users cannot distinguish “no data” from outage or authorization failure |
| M-06 | Address form has no field length or normalization feedback | Poor data quality and potential database bloat |
| M-07 | Destructive address deletion lacks confirmation | Accidental data loss and avoidable support requests |
| M-08 | Cart removal has no undo/confirmation | Accidental loss of a customized item |
| M-09 | Cart and menu image failures have inconsistent fallback behavior | Broken images degrade trust and layout stability |
| M-10 | No visible offline/reconnect state | Users may submit or believe an order succeeded while disconnected |
| M-11 | No receipt download/share/email capability | Operational support burden and poor customer recovery after navigation |
| M-12 | No customer cancellation/refund workflow is visible | Business and support process is incomplete if cancellation is expected |
| M-13 | No explicit delivery ETA or fulfillment SLA | Customers cannot distinguish normal delay from a stuck order |
| M-14 | Static copy does not identify service area, cutoff times, or holiday exceptions | Orders may be placed when fulfillment is unavailable |
| M-15 | External images/fonts are runtime dependencies | Third-party outages or blocking can degrade the public entry page |
| M-16 | No pagination on vendor order view | Performance and accidental PII exposure worsen as data grows |
| M-17 | Wildcard `select('*')` is used in customer/order/admin flows | Future columns can unintentionally become client-visible |
| M-18 | Nested order/item reads have partial failure states | UI can show an order without its items or vice versa |
| M-19 | Timestamp/date formatting is hardcoded to `en-IN` in places | Locale and timezone behavior is inconsistent for a broader audience |
| M-20 | UI contains a visible “Coming Soon” admin action | Signals unfinished functionality and may create false expectations |
| M-21 | No documented maximum order size, item count, or notes length in the UX | Server rejection becomes a surprise rather than guided validation |
| M-22 | No user-facing correlation/reference code for support | Troubleshooting requires searching by PII or guessing from order data |
| M-23 | No explicit feature flags for unfinished admin/vendor capabilities | Partial features may be exposed accidentally during rollout |
| M-24 | No browser compatibility matrix or real-device acceptance evidence | A successful Vite build does not prove mobile/browser correctness |

## 10. Recommended implementation order

### Before any launch-candidate build

Remove the Supabase fallback, resolve the high `ws` vulnerability, finalize the role model, make the latest migrations immutable and deployable, decide vendor visibility, and establish the production/staging project separation. Add a global error boundary, safe error mapping, and explicit failure states for auth, menu, profile, checkout, and order tracking.

### Before private beta

Implement database idempotency, server-generated order identifiers, query indexes, field constraints, timezone-aware menu selection, authoritative-total presentation, address validation, polling improvements, and a complete authenticated test matrix. Run the app through a real Supabase staging project with the same migrations and quotas as production.

### Before public launch

Complete accessibility and mobile acceptance tests, publish privacy/terms/support policies, add observability and on-call ownership, rehearse backup restoration and incident response, verify Storage or formally declare it out of scope, and obtain sign-off from product, engineering, security, and operations.

### After launch but within the first sprint

Add Realtime or efficient order-status delivery, receipts/notifications, customer cancellation/refund handling, data retention automation, audit-log dashboards, tenant-scoped vendor support if needed, and a formal threat model update based on real traffic patterns.

## 11. Go/no-go checklist

| Gate | Pass condition | Owner |
| --- | --- | --- |
| Security migrations | Hosted migration history matches repository; clean reset and policy inventory pass | Backend |
| RLS | Customer, vendor, admin, anonymous, and expired-session suites pass | Security/Backend |
| Checkout | Server totals, idempotency, replay, concurrency, address ownership, and status tests pass | Backend/QA |
| Auth | Signup verification, sign-in, reset, sign-out, refresh, and rate-limit paths pass | Backend/Frontend |
| Dependencies | No unaccepted high/critical vulnerability; lockfile is reviewed | Engineering |
| Storage | Buckets and object policies are either tested and private-by-default or explicitly out of scope | Security/Backend |
| Privacy | Policies, retention, deletion, PII visibility, and support process approved | Product/Legal |
| Accessibility | Keyboard, screen-reader, focus, contrast, zoom, reduced-motion, and mobile checks pass | QA/Design |
| Reliability | Error monitoring, alerts, backups, restore drill, and incident owner confirmed | Operations |
| Deployment | Protected environment, required checks, migration gate, rollback/forward-fix rehearsal | DevOps |
| Product acceptance | Hours, fees, availability, cancellation, ETA, support, and vendor workflow signed off | Product |

## 12. Final recommendation

The application is a reasonable candidate for a **controlled staging or private beta** after the migration chain, dependency vulnerability, environment fallback, and integration-test gates are addressed. It is **not yet ready for an unrestricted public launch** because the remaining risks are not limited to polish: they include environment misconfiguration, dependency exposure, order replay, role/UI inconsistency, incomplete production verification, vendor PII scope, missing operational evidence, and unbounded growth/performance paths.

The best launch strategy is a staged rollout: first prove a clean isolated deployment and security suite, then run a small internal/vendor pilot, then a limited customer beta with monitoring and manual order reconciliation, and only then enable broader traffic after the go/no-go table is fully green.

## References

[1]: https://owasp.org/www-project-application-security-verification-standard/ "OWASP, Application Security Verification Standard,"

[2]: https://www.w3.org/TR/WCAG22/ "W3C, Web Content Accessibility Guidelines (WCAG ) 2.2,"

[3]: https://supabase.com/docs/guides/storage/security/access-control "Supabase, Storage Access Control,"

[4]: https://supabase.com/docs/guides/storage/s3/authentication "Supabase, S3 Authentication,"


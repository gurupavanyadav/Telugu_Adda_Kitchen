# Production RLS Incident-Response Playbook

**Owner:** Engineering and Security

**Scope:** Suspected row-level-security bypass, unauthorized order creation or modification, cross-customer data access, role escalation, or suspicious Supabase RPC activity.

> This playbook is for a controlled production response. Preserve evidence before making destructive changes, use a staging project to rehearse migrations, and obtain the incident commander’s approval before disabling customer or vendor functionality.

## 1. Trigger conditions and severity

Open an incident when an order changes without a matching user action, a customer reports another customer’s data, a vendor modifies protected order fields, an unexpected role appears in `user_roles`, or database logs show denied or anomalous RPC/policy activity.

| Severity | Example | Initial target |
|---|---|---|
| SEV-1 | Confirmed cross-customer address/order exposure, mass unauthorized modifications, or active role escalation. | Page incident commander immediately; contain within 15 minutes. |
| SEV-2 | Confirmed single-account unauthorized order mutation, repeated failed bypass attempts, or suspicious privileged activity without confirmed exposure. | Assign incident commander and investigate within 30 minutes. |
| SEV-3 | Isolated denied probes, test-environment findings, or policy drift without evidence of exploitation. | Track, reproduce, and remediate in the next release window. |

## 2. Roles and communication

The incident commander owns the timeline and decisions. The database owner applies or reviews policy changes. The application owner verifies client and RPC behavior. The security lead coordinates evidence handling and impact assessment. Customer support communicates only approved facts and does not speculate about affected users.

Create one incident channel and one immutable incident log. Record timestamps in UTC, actor, user ID, order ID, request ID, database migration version, query or RPC name, observed result, action owner, and approval. Do not paste access tokens, service-role keys, passwords, or complete customer addresses into chat.

## 3. Immediate containment

Within the first response window:

1. Confirm the report using a safe read-only query or a staging reproduction. Do not use a customer session to probe another customer’s data.
2. Freeze deployment and migration changes. Do not edit an already-applied migration; create a new timestamped migration.
3. Preserve Supabase database logs, Auth audit logs, API gateway logs, GitHub Actions logs, and application error logs for the suspected time window. Export them to the approved incident evidence store with restricted access.
4. If exploitation is active, temporarily disable the affected client path or RPC at the edge/application layer. Prefer a feature flag or a server-side deny over changing production policies manually.
5. Rotate any credential that may have been exposed, especially service-role keys, CI secrets, database passwords, and third-party webhook keys. Never place replacement secrets in source control.
6. If unauthorized changes are ongoing, revoke the affected user session through the Auth administration workflow and suspend the affected account only after preserving the user ID and evidence.

A database-wide RLS disable is not an acceptable containment measure. If a policy must be changed urgently, use a reviewed migration that narrows access, has a rollback plan, and is applied through the normal controlled channel.

## 4. Evidence collection

Collect the following before remediation where feasible:

| Evidence | What to capture |
|---|---|
| Database logs | Timestamp, role, query/RPC, SQLSTATE, request ID, affected relation, and result. |
| Auth logs | User ID, sign-in, refresh, password reset, session revocation, and failed authentication events. |
| Application logs | Checkout payload shape without secrets, order ID, authenticated user ID, RPC result code, and client build version. |
| Current schema | Migration version, `pg_policies`, table grants, function definitions, and trigger definitions. |
| Data snapshot | Affected order/address rows and related audit evidence, with access restricted and sensitive fields minimized. |
| Source/deployment | Commit SHA, workflow run, deployment timestamp, and applied migration list. |

For policy state, capture results equivalent to:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

SELECT routine_schema, routine_name, routine_type, security_type, external_language
FROM information_schema.routines
WHERE routine_schema IN ('public', 'private')
ORDER BY routine_schema, routine_name;

SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
ORDER BY table_name, grantee, privilege_type;
```

Do not run these queries with a customer’s client session. Use an approved read-only administrative connection or Supabase database inspection workflow.

## 5. Investigation workflow

First establish whether the report is a true authorization failure or a UI/reporting issue. Compare the order’s `user_id`, the authenticated actor ID, the current role in `user_roles`, the legacy `profiles.role` value if present, and the order’s `created_at`/`updated_at` timestamps. Check whether the change came through the intended RPC, a direct PostgREST table mutation, a vendor workflow, a service-role process, or a migration/seed job.

For unauthorized order modifications, compare the original and current values of `status`, `user_id`, `order_number`, `delivery_address`, `items_total`, `delivery_fee`, `grand_total`, `notes`, and `updated_at`. Examine related `order_items` and the order’s ownership. Treat a changed protected field as an integrity incident even if the customer-facing total was not changed.

For suspected RLS bypasses, verify all of the following in the affected environment:

- RLS is enabled on every affected table.
- No permissive legacy policy remains, especially `Admins can view all addresses`, broad customer writes, or authenticated-wide catalog writes.
- Direct customer order and order-item mutation policies are absent.
- Vendor policies use the canonical `user_roles` lookup and do not permit ownership or monetary-field changes.
- Security-definer functions use a fixed empty `search_path`, fully qualified object names, and restricted `EXECUTE` grants.
- The client can execute only the intended public wrapper and cannot execute private writer functions.

## 6. Containment decisions

Use the least disruptive control that stops the suspected path. If the issue is a vulnerable frontend release but the database contract is safe, disable checkout or the affected UI route and roll back the frontend. If the RPC contract is unsafe, revoke its execute grant or deploy a reviewed replacement wrapper. If direct table writes are exposed, remove the policy and privilege through a new migration. If a vendor account is compromised, revoke its sessions and remove its `user_roles` row after preserving evidence and obtaining approval.

Keep customer read access to their own orders and addresses whenever it is safe. Avoid broad service outages caused by revoking all authenticated access unless the incident commander determines that the scope cannot be bounded.

## 7. Remediation and recovery

Prepare a new migration in a branch, run the RLS and checkout integration suites against a fresh database, and review the exact policy diff. The migration should remove the legacy address/admin policies, preserve owner-scoped address CRUD, preserve only intended vendor capabilities, and revoke unsafe client execution paths. Apply it to staging first, run regression tests, then apply to production through the approved deployment workflow.

After deployment:

1. Re-run the policy and grant inspection queries.
2. Execute the authenticated customer, vendor, and anonymous regression suites.
3. Verify that affected orders and addresses have the correct owner and current values.
4. Revoke or rotate compromised sessions and credentials.
5. Restore the checkout feature only after the database and application contracts agree.
6. Monitor denied policy checks, RPC failures, order changes, and support reports at increased frequency for at least one business cycle.

For unauthorized order data, do not silently rewrite history. Record the original and corrected values in the approved incident record, notify affected stakeholders according to the organization’s privacy and legal requirements, and preserve the evidence chain.

## 8. Closure criteria

Close the incident only when the attack path is removed, affected credentials and sessions are handled, data integrity is assessed, regression tests pass, monitoring is active, and the incident commander approves the final impact statement. The post-incident review should document root cause, why existing tests did or did not catch it, the exact policy/migration gap, time to detect, time to contain, and a dated remediation owner.

## 9. Preventive controls

Keep RLS tests in CI for every migration and security-sensitive checkout change. Require a fresh-database migration test, database linting, authenticated customer/vendor/anonymous test sessions, and deployment gating. Maintain one canonical role table. Review all `SECURITY DEFINER` functions for fixed search paths and least-privilege execution. Treat client totals, prices, fulfillment fees, ownership IDs, and status values as untrusted intent; derive or validate them in the database.

## References

[1]: `supabase/migrations/20260816000004_remove_legacy_admin_rls.sql` — NRL-01/NRL-02 remediation migration.
[2]: `scripts/test-address-rls.mjs` — automated customer, legacy-admin, vendor, and anonymous address-policy tests.
[3]: `scripts/test-rls.mjs` — automated order RLS and status-transition tests.
[4]: `scripts/test-checkout.mjs` — automated server-calculated checkout validation tests.
[5]: `supabase/migrations/20260816000001_fix_sec01_sec03.sql` — direct order mutation removal and vendor update restrictions.

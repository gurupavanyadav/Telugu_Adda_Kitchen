# Delivery App Remediation Package

## Purpose

This archive contains the complete patched delivery-app working tree together with the security, launch-readiness, and P0 closure evidence produced to date. It is structured for code review, staging deployment, and the remaining P0 verification sequence. It excludes local dependency directories, build output, Git history, `.env` files, and any secrets.

> **Do not apply these migrations directly to production.** First run the documented staging sequence, retain the policy and test evidence, and complete the protected deployment/recovery rehearsal.

## Package layout

| Location | Contents | Use |
| --- | --- | --- |
| `delivery-app/` | Complete patched React/Vite/Supabase source tree | Primary implementation artifact |
| `delivery-app/supabase/migrations/` | Ordered, immutable SQL migrations | Apply in staging through the protected migration workflow |
| `delivery-app/supabase/verification/` | Migration checksum manifest and hosted policy/grant inventory | Verify exact migration artifacts and hosted authorization state |
| `delivery-app/scripts/` | Configuration, RLS, checkout, address, and migration checks | Run static and live verification suites |
| `delivery-app/.github/workflows/` | Security, migration, and deploy gates | Configure as required checks in GitHub |
| `delivery-app/supabase-migration-release-procedure.md` | Backup, migration, verification, and forward-fix procedure | Use before any hosted migration |
| `delivery-app/vendor-fulfillment-data-boundary.md` | Approved single-operator vendor data contract | Use for product and security sign-off |
| `delivery-app/delivery-app-p0-closure-p1-verification-report.md` | Current evidence, results, and remaining external gates | Starting point for staging acceptance |
| `reports/` | Original review, security scan, pentest, storage audit, and launch-readiness reports | Historical evidence and finding traceability |

## Migration sequence

Apply the reviewed migrations in ascending order. Never edit a migration once it has been applied; create a new migration for every corrective change.

1. `20260816000000_harden_order_creation.sql`
2. `20260816000001_fix_sec01_sec03.sql`
3. `20260816000002_secure_create_order_rpc.sql`
4. `20260816000003_harden_checkout_security.sql`
5. `20260816000004_remove_legacy_admin_rls.sql`
6. `20260816000005_add_order_idempotency.sql`
7. `20260816000006_vendor_fulfillment_contract.sql`

## Immediate staging sequence

Begin only after selecting a separate staging Supabase project and configuring the protected GitHub environment. The required names are `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`. The `VITE_*` values are browser-public configuration only; never place `SUPABASE_SERVICE_ROLE_KEY` in a `VITE_*` variable.

```bash
npm ci
npm run verify:migrations
npm run test:supabase-config
npm run typecheck
npm run audit:prod

# In a Docker-enabled local stack or with authorized staging test values:
npm run test:rls
npm run test:checkout
npm run test:address-rls
```

For the complete hosted migration and recovery flow, follow `delivery-app/supabase-migration-release-procedure.md` exactly.

## Archive integrity

`SHA256SUMS` contains checksums for the packaged files. Validate the unpacked archive with:

```bash
sha256sum --check SHA256SUMS
```

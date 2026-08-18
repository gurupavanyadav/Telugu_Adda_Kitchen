# Protected Supabase Migration and Recovery Procedure

## Purpose

This procedure governs every production Supabase schema change. A frontend deployment is not evidence that database hardening has reached the hosted project. The protected migration workflow performs a clean local migration proof, applies only reviewed pending migrations after production approval, and records hosted policy and grant evidence.

## Required GitHub production-environment configuration

Create a protected GitHub Actions environment named `production`. Require an approver who is independent of the author of the migration. Restrict deployment to `main`, and configure the following protected values there.

| Value | Storage | Purpose |
| --- | --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Secret | Authenticates the Supabase CLI. |
| `SUPABASE_DB_PASSWORD` | Secret | Links the CLI to the protected database. |
| `SUPABASE_PROJECT_REF` | Environment variable | Identifies the production Supabase project. |
| `SUPABASE_BACKUP_VERIFIED_AT` | Environment variable | Records the timestamp of the recovery-point verification. |
| `SUPABASE_BACKUP_EVIDENCE_URL` | Environment variable | Links the approved backup or recovery-point evidence. |
| `VITE_SUPABASE_URL` | Environment variable | Used only by the frontend production build. |
| `VITE_SUPABASE_ANON_KEY` | Environment variable | Used only by the frontend production build; never substitute a service-role key. |

## Release sequence

Before approving a migration, confirm that the migration checksum manifest is updated only for a newly added migration. Existing migration SQL must never be edited after it has reached a shared or hosted environment. If a defect is discovered, create a new forward-fix migration instead.

The workflow verifies the migration manifest, runs the production dependency audit, proves a clean local `supabase db reset`, and executes the policy/grant inventory before it can enter the protected production job. The production approver must verify the backup timestamp and evidence link are current, then approve the environment. The workflow records remote migration history before and after `supabase db push --linked`, and fails if required hardened migrations, RLS, RPC grants, or legacy-policy checks do not match the expected state.

## Recovery and forward-fix policy

Do not automatically issue destructive rollback SQL against production. If a migration introduces a defect, first stop the affected frontend release, preserve the migration and audit evidence, and assess whether a non-destructive forward-fix migration can restore the intended behavior. Use a database recovery point only when the incident commander determines that the data impact and recovery window justify it.

Every recovery exercise must record the incident owner, affected migration version, backup or recovery-point identifier, expected data loss window, validation queries, and the decision to resume traffic. After recovery or a forward fix, rerun the hosted policy/grant inventory, the authenticated RLS suites, and the checkout suite before reopening deployment.

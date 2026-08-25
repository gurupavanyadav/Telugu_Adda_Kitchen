# External Evidence Captured for Audit — 25 August 2026

## GitHub Actions status

Source: https://github.com/gurupavanyadav/Telugu_Adda_Kitchen/actions

The authenticated GitHub Actions page showed **34 workflow runs**. The latest entry was the successful ninth run of **Rehearse production encrypted backup recovery**, run `32875657214`, on `main`. The page also showed successful entries for production live P0 verification `32851577643`, production Auth-trigger grant fix `32849621528`, production P0 migration `32836755375`, and the final staging Auth-trigger validation `32848536963`.

The same view also shows historical failed recovery attempts #1–#8. Those attempts predate the successful final run and correspond to documented workflow compatibility/target-setup corrections; the final status conclusion must rely on successful run `32875657214`, not on the count of earlier attempts.

## Supabase project service state

Source: https://supabase.com/dashboard/project/yuindzemvnnzrtzohbkz

The staging dashboard showed **Status: Healthy**, nano compute, Mumbai (`ap-south-1`), and recent migration `revoke_handle_new_user_execute` after staging was restored.

Source: https://supabase.com/dashboard/project/wuliwrflgjfwnftvkynd

The isolated recovery-drill dashboard stated that project `delivery-app-production-recovery-drill` is **paused**. Production was not opened or changed during this status check.

Source: https://supabase.com/dashboard/project/xwxjxmbafiguwrqbxgoz

The production dashboard showed **Status: Healthy**, nano compute in Mumbai (`ap-south-1`), and last migration `revoke_handle_new_user_execute`. It displayed **No repository connected** in Supabase’s own GitHub integration, which does not negate the separate protected GitHub Actions deployment controls but means the dashboard is not connected to GitHub through that optional Supabase integration. The dashboard’s built-in scheduled-backup card showed **No backups**, consistent with the selected Free-tier logical-export recovery model. In the sampled last-hour counters it reported 100% success for eight requests and zero displayed API Gateway/Storage errors. This is an observed dashboard snapshot, not a substitute for an application synthetic-monitoring or alerting program.

## GitHub repository security and branch governance

Source: https://github.com/gurupavanyadav/Telugu_Adda_Kitchen/security

The GitHub security overview showed: security policy **disabled**; private vulnerability reporting **disabled**; Dependabot alerts **disabled**; code scanning **needs setup**; and secret scanning **enabled**.

Source: https://github.com/gurupavanyadav/Telugu_Adda_Kitchen/settings/branches

The Branch protection rules page stated that classic branch protections have **not been configured**. No branch ruleset was displayed. Consequently, the protected GitHub environment controls guard the manual deployment workflows, but repository-wide pull-request, review, status-check, force-push, and deletion protections are not evidenced by branch rules.

Source: https://github.com/gurupavanyadav/Telugu_Adda_Kitchen/settings/environments/20551012081/edit

The production environment requires approval by `gurupavanyadav`, applies only to `main`, and has administrator bypass disabled. The UI displayed the expected names of ten encrypted environment secrets: `BACKUP_ENCRYPTION_PASSPHRASE`, `RECOVERY_TARGET_ANON_KEY`, `RECOVERY_TARGET_DB_URL`, `RECOVERY_TARGET_PROJECT_REF`, `RECOVERY_TARGET_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SUPABASE_URL`. No secret value was viewed, copied, or recorded. The environment is strong gating for the manually dispatched production workflows, but it is not a substitute for a `main` branch protection/ruleset or automatically triggered CI.

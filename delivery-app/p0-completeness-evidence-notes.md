# P0 Completeness Evidence Notes — 19 August 2026

## Original P0 closure criteria

The launch-readiness review requires: (1) a protected hosted migration comparison, clean reset, policy/grant inventory, and full authenticated RLS/checkout/address/escalation testing; (2) fail-fast public Supabase configuration with no unsafe fallback; (3) remediation of the high `ws` vulnerability plus dependency audit evidence; (4) a documented single-operator vendor data boundary or tenant-scoped alternative; and (5) a protected production migration/recovery procedure with a pre-migration backup/recovery point and tested forward-fix or restore procedure.

Source: `/home/ubuntu/upload/DeliveryAppLaunch-ReadinessReview.md`, lines 23–55.

## Evidence reconciliation

| P0 item | Evidence of completion | Remaining limitation |
| --- | --- | --- |
| P0-01 — hosted migration/RLS state | Final staging run `32175600478` passed RLS 13/13, checkout 6/6, address 6/6, and configuration preflight. Immutable manifest, policy/grant inventory, fixed staging target, and guarded migration workflow are recorded. | Evidence is **staging only**, not production. The original P0 requires protected hosted evidence for the release environment. |
| P0-02 — unsafe Supabase fallback | P0 closure report says embedded fallback was removed and final configuration preflight passed. | Closed for the reviewed code/staging workflow; production build/release configuration still requires its own controlled deployment evidence. |
| P0-03 — high `ws` vulnerability | Closure report records a narrow override and a prior zero moderate-or-higher production dependency-audit result for the reviewed lockfile. | Must be rerun against the exact production release lockfile; action-runtime maintenance is an outstanding non-P0 CI task. |
| P0-04 — vendor visibility | Single trusted restaurant operator is formally approved. Vendor contract exposes only fulfillment data through two RPCs and excludes customer ID/profile and price/total data. Final staging RLS run passed the vendor boundary tests. | Any marketplace/multi-operator expansion requires tenant-scoped redesign first. |
| P0-05 — migration/recovery procedure | Protected staging environment has owner approval, no admin bypass, and main-only branch access. The forward-fix rehearsal passed; duplicate migration application failed closed and final live validation passed. | The staging Nano project reported `LAST BACKUP: No backups`; no snapshot restore occurred. The production procedure still requires a current production recovery point, independent production approver, and separately approved restoration drill. |

## Definitive distinction

The P0 closure report explicitly labels the staging P0 security remediation as PASS, but labels backup/restoration rehearsal NOT COMPLETE and production launch authorization NO-GO until recovery-point evidence exists. It says P1 is excluded from its scope.

## Connected Supabase inventory check — 19 August 2026

The enabled Supabase connector’s read-only `list_projects` result contains exactly one project: `delivery-app-staging` (ref `yuindzemvnnzrtzohbkz`) in `ap-south-1`, status `ACTIVE_HEALTHY`. No separate production project is available through the connected Supabase account. Accordingly, a production recovery point and production restoration rehearsal cannot be performed until the user supplies a different production project/account or authorizes the creation and funding of a separate production project.

## Production-environment creation — 19 August 2026

With the user’s explicit cost and creation confirmations, the connected Supabase service created `delivery-app-production` (ref `xwxjxmbafiguwrqbxgoz`) in `ap-south-1`. The quoted initial project-creation cost was $0/month. The project is separate from `delivery-app-staging`; it is not yet populated with the approved migration set, protected release configuration, recovery evidence, or a restoration-rehearsal result. It must not yet be treated as launch-ready.

## Pre-production staging reconciliation — 19 August 2026

The local immutable manifest verifies all 20 reviewed migration files successfully by SHA-256. The connected Supabase `list_migrations` result for `delivery-app-staging` (`yuindzemvnnzrtzohbkz`) reports the identical 20 ordered migration versions, ending with `20260818000006_grant_authenticated_address_crud`. The hosted GitHub Actions workflow page for `staging-live-p0-verification.yml` confirms that the prior Run 10 completed successfully. At the user’s request, a fresh non-destructive staging validation will be dispatched before any production schema migration is considered.

Sources:

- `/home/ubuntu/delivery-app-review/delivery-app/delivery-app-p0-closure-p1-verification-report.md`, lines 1–22, 24–32, 87–97.
- `/home/ubuntu/delivery-app-review/delivery-app/staging-recovery-rehearsal-2026-08-19.md`, lines 1–41.
- `/home/ubuntu/delivery-app-review/delivery-app/supabase-migration-release-procedure.md`, lines 7–31.
- `/home/ubuntu/delivery-app-review/delivery-app/vendor-fulfillment-data-boundary.md`, lines 3–21.
- `/home/ubuntu/delivery-app-review/staging-run-monitoring.md`, lines 142–156.

## Fresh staging pre-production validation — 19 August 2026

Prior to any production schema change, the protected staging workflow `staging-live-p0-verification.yml` ran from commit `06ddeeb` under the `staging` approval gate. Run `32228491813` **succeeded** in 1 minute 5 seconds after completing the target/secret preflight, ephemeral credential handling, immutable-manifest check, local configuration guardrails, RLS suite, checkout suite, and address-RLS suite. The GitHub job had one non-blocking runner warning and no failed step. This is positive evidence for the production-migration decision; it does not itself migrate, validate, or back up the new production project.

## Official migration-control findings — 20 August 2026

Supabase’s deployment guidance states that remote schema changes should be deployed from migration files with `supabase db push`; the CLI compares the local `supabase/migrations` directory with `supabase_migrations.schema_migrations` and applies pending versions in order. It also cautions that direct remote schema changes can cause migration-history synchronization failures. Source: https://supabase.com/docs/guides/deployment/database-migrations

The current Supabase Management API reference exposes distinct database endpoints to list applied migration versions, apply a database migration, upsert a migration-history entry without applying it, roll back history entries, fetch a migration-history entry, and patch an existing migration-history entry. It also exposes backup-listing and backup-schedule endpoints. Source: https://api.supabase.com/api/v1#tag/database

These controls mean the production rollout must preserve the repository’s exact versioned migration history, not merely execute equivalent schema SQL. The selected method therefore needs either a CLI `db push` using the repository’s migration files or a documented, carefully verified Management-API sequence that records exact versions only after the corresponding SQL succeeds.

## Guarded production migration workflow prepared — 20 August 2026

The proposed `production-apply-p0-migrations.yml` workflow was locally validated and populated in the GitHub repository editor. It is deliberately separate from the staging workflow and runs only in the protected `production` environment. It requires the explicit phrase `APPLY_PRODUCTION_P0_MIGRATIONS`, fail-closes unless the protected project reference equals `xwxjxmbafiguwrqbxgoz`, checks the 20-file immutable manifest, requires zero previously applied repository migrations, runs `supabase db push --linked`, and verifies exactly 20 matching local and remote history entries plus the hosted policy/grant inventory. Its evidence artifact is retained for 90 days.

The GitHub new-file form initially duplicated the displayed filename during an editor interaction. The underlying form value was corrected directly to `production-apply-p0-migrations.yml` before commit; the workflow content itself was unchanged.

## Production GitHub environment configured — 25 August 2026

The repository now contains the guarded production workflow at commit `920e71d`. The GitHub `production` environment has `gurupavanyadav` as the required reviewer, administrator bypass disabled, and a single permitted deployment branch: `main`. The environment secret list was refreshed and contains exactly the required workflow names: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, and `SUPABASE_PROJECT_REF`. Secret values were neither retrieved nor recorded.

## Guarded production migration dispatch — 25 August 2026

After the user gave a separate final confirmation, the workflow `production-apply-p0-migrations.yml` was dispatched from `main` at commit `920e71d` as run `32836755375`, using the required authorization phrase. The run initially entered the queued state. No production SQL result has been inferred from dispatch alone; the next required evidence is the protected-environment approval state and the job outcome.

## Production migration result — 25 August 2026

Following the user’s explicit approval of the protected `production` deployment request, GitHub job `97767226987` in run `32836755375` succeeded in 49 seconds. The completed job steps included checksum verification of immutable migration artifacts, linking only the isolated production project, confirming no prior repository migrations, applying the reviewed migration sequence, and verifying hosted history, policies, and grants. GitHub displayed one runner annotation warning; it did not fail any job step. Detailed step output and the uploaded evidence artifact remain the source of record for the precise post-migration assertions.

## Independent production migration and advisor check — 25 August 2026

The connected Supabase service independently returned all 20 applied production migration versions in order, from `0001` through `20260818000006`. This confirms the guarded GitHub workflow’s hosted-history result.

The same read-only production security-advisor check identified one unintended exposure that keeps P0 open: `public.handle_new_user()` is a `SECURITY DEFINER` Auth trigger function but has direct `EXECUTE` grants for `anon` and `authenticated`. A direct grant inspection also showed `service_role` execution. The function should be called only by `on_auth_user_created`, not through the public RPC surface.

The user approved preparation and staging validation of a forward-only remedial migration, `20260825000000_revoke_handle_new_user_execute.sql`. It revokes direct execution from `PUBLIC`, `anon`, `authenticated`, and `service_role`, while preserving the Auth trigger. The immutable manifest and hosted policy/grant inventory have been expanded to cover this 21st migration and fail when any client-facing role regains direct execution. Production remains unchanged pending separate staging evidence and a later protected production approval.

The guarded staging validation, guarded production forward-fix, and encrypted recovery-rehearsal workflows were published to `main` in GitHub commit `3d225f9`. Their presence alone does not dispatch a database change, export, or restoration.

The forward-only SQL migration itself was published to `main` in GitHub commit `2226a2f`. The matching checksum manifest, hosted verification inventory, and Auth-trigger regression test are still being published and no staging or production migration has been dispatched.

The checksum-manifest update is staged in the GitHub editor with the independently calculated SHA-256 value `c91002ed24fdc5ff3ceec4da7128f4f8286ce165cf4e48a9d3e773f30242d89c` for the new migration. It remains uncommitted at this point.

The focused `test-auth-profile-trigger.mjs` regression test has been uploaded to the repository’s `delivery-app/scripts` directory and is awaiting its commit. The test creates a disposable confirmed user through the authenticated administrative test path, requires the internal Auth trigger to create a `customer` profile, and then deletes the disposable user.

The regression test was committed to `main` in GitHub commit `dec0d66`. At this point, the policy/grant inventory and `package.json` script registration still need to be published before staging validation can be dispatched.

The hosted policy/grant inventory is staged with the 21st migration requirement, direct-execution checks for `public.handle_new_user()`, and a final routine-grant inventory query. It has not yet been committed.

The inventory strengthening was committed to `main` in GitHub commit `39a20d2`. Only the `package.json` script registration remains before the guarded staging validation workflow can be dispatched.

The `test:auth-profile-trigger` package script is staged in the GitHub editor and has been checked as valid JSON. It is not yet committed.

The package-script registration was committed to `main` in GitHub commit `72500bb`. The forward-only migration, immutable manifest, hosted inventory, focused test, and guarded staging workflow are now published; staging validation remains the next approved action.

The user-approved protected staging forward-fix workflow was dispatched from `main` at commit `72500bb` as GitHub run `32840613098`. At dispatch, the run was queued. No staging migration or validation result is inferred until the workflow reports a completed outcome.

The protected `staging` environment gate for run `32840613098` was approved by the configured reviewer. The run has been released from the gate, but its migration and validation outcome are still pending.

Run `32840613098` later completed with failure after 33m 41s. GitHub currently reports one unspecified exit-code-1 job failure, a non-blocking Node 20 deprecation warning, and an expected missing-artifact warning caused by the failed job. The detailed job log must be inspected before diagnosing whether the staging migration ran or whether any repair is needed.

The detailed job log shows that the failure occurred in `supabase link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"` with `Unexpected error retrieving remote project status: {"message":"Unauthorized"}`. The workflow stopped before its pending-version check, staging migration application, service-role credential retrieval, policy inventory, and live tests. Consequently, migration `20260825000000` was not applied to staging by this run.

The expired staging access token was replaced by the operator with a newly generated, project-scoped token for `delivery-app-staging`; its value was not observed or recorded. The guarded validation was re-run as attempt #2 of GitHub run `32840613098` and was queued at dispatch. It has not yet applied the migration or reached its validation steps.

The protected `staging` environment gate for attempt #2 was approved by the configured reviewer. The re-run is released from the gate; its migration and validation results are pending.

After release from the staging gate, attempt #2 entered `In progress` / `Deploying to staging`. No completed migration, inventory, or live-test result has been observed yet.

Attempt #2 authenticated to the staging project successfully, confirming that the new staging-only token works. Its guard then stopped at the pending-version check because the hosted staging history already contains migration `20260825000000` (recorded at `2026-08-25 00:00:00`). The job did not run its post-migration inventory or Auth trigger regression test. The forward-fix workflow must be made idempotent for the valid “already applied” case, then re-run only its validations.

The guarded staging workflow has been revised in the GitHub editor to accept either the expected 20-version/pending state or the verified 21-version/already-applied state. In the latter case it skips `supabase db push` and continues into the hosted inventory and regression checks. The revision is staged but not yet committed.

The idempotent staging-validation correction was committed to `main` in GitHub commit `b370a65` (`fix(ci): validate already-applied staging forward fix`). The remote workflow source was verified to contain both the already-applied guard and the conditional `supabase db push` step.

The user-approved final staging verification-only pass was dispatched as GitHub run `32848536963` from `main` at commit `b370a65`. At dispatch it was queued; no verification outcome is implied until the protected workflow completes.

The configured reviewer approved the protected `staging` gate for run `32848536963`. The verification-only job is released from the gate; its inventory and test outcome are pending.

Following gate approval, run `32848536963` entered `In progress` / `Deploying to staging`. Its hosted inventory and disposable regression-test outcomes have not yet been observed.

Run `32848536963` / job `97803785166` succeeded in 1m15s. Its idempotent guard recognized the existing hosted version, the migration-application step was skipped, the hosted history/policy-grant/Auth-profile-trigger check passed, and the staging RLS, checkout, and address authorization controls completed successfully. The run uploaded `staging-handle-new-user-forward-fix-evidence`. GitHub displayed one non-blocking Node.js 20 action-runtime deprecation warning; no workflow step failed.

After reviewing the successful staging evidence, the operator separately approved dispatch of the guarded production forward-fix workflow. The production dispatch form is open; no production workflow run or migration result has been recorded yet.

The guarded production forward-fix workflow was dispatched as GitHub run `32849621528` from commit `b370a65`. It was queued at dispatch; no production migration has run and no verification outcome is implied yet.

The configured reviewer approved the protected `production` gate for run `32849621528`. The workflow is released from the gate; the production migration and hosted verification outcome are pending.

After production-gate approval, run `32849621528` entered `In progress` / `Deploying to production`. No completed migration or hosted-inventory result has been observed yet.

Run `32849621528` / job `97807227096` succeeded in 44s. It verified the 20-version precondition, applied forward-only migration `20260825000000`, then passed its hosted migration-history, policy, and grant inventory verification. The workflow uploaded `production-handle-new-user-forward-fix-evidence`. GitHub displayed only the non-blocking Node.js 20 action-runtime deprecation warning. This closes the direct-execution exposure identified by the post-migration production advisor check; it does not by itself complete P0, which still requires production live runtime verification and the approved Free-tier recovery rehearsal.

The newly authorized `production-live-p0-verification.yml` workflow is staged in the GitHub editor. It was statically checked for its fixed production ref/endpoint, explicit confirmation phrase, ephemeral service-role masking, and production-evidence artifact configuration. It has not yet been committed or dispatched.

The guarded production runtime-verification workflow was published in commit `7fe1e1b` (`test(production): add guarded live P0 verification`). It is not dispatched and will remain unable to start until the protected production endpoint and publishable-key configuration is supplied.

The production environment now contains the secret names `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in addition to the existing protected migration/recovery configuration. Their values were retrieved read-only from the production project and entered only into GitHub’s encrypted environment-secret fields; no values were written to repository content, task evidence, or user-facing messages. The runtime-verification workflow remains undispatched.

The operator separately approved production live verification. GitHub run `32851577643` was dispatched from commit `7fe1e1b` and is queued. It has not created fixtures or run tests yet; it must first reach and receive approval at the protected `production` environment gate.

The configured reviewer approved the protected `production` gate for live-verification run `32851577643`. The job is released from the gate; its fixture creation, cleanup, and test outcome remain pending.

Production live-verification run `32851577643` / job `97813524079` succeeded. The protected job completed in 1m06s after gate approval, and the run uploaded one `production-live-p0-verification-evidence` artifact. GitHub displayed only the non-blocking Node.js action-runtime deprecation warning. This confirms the workflow completed successfully; the retained artifact contains the individual suite output. P0 still requires the separately approved encrypted logical export and isolated Supabase restore rehearsal.

Supabase Free-tier project creation was initially blocked because the organization has a two-active-project limit while both staging and production were healthy and active. After a separate user approval, staging (`yuindzemvnnzrtzohbkz`) was paused only; no staging data was deleted and production was untouched. This freed the slot for the user-approved isolated recovery project `delivery-app-production-recovery-drill` (`wuliwrflgjfwnftvkynd`, Mumbai/ap-south-1), which is `ACTIVE_HEALTHY` and has not received any production export or restore.

## Recovery credential authorization finding — 25 August 2026

The latest guarded recovery attempt completed the encrypted export, isolated restore, 21-version migration-history check, and hosted policy/grant verification. It stopped before the recovered-target live suites because the production-scoped Supabase access token is not authorized to retrieve API keys from the separate recovery project. The access denial is an intentional cross-project boundary; no production write occurred and the encrypted evidence artifact was retained. The recovery workflow correction was published in GitHub commit `7de533d` to consume two protected production-environment secret inputs for the recovery project’s test-only service-role and publishable keys, rather than retrieving them at runtime. Both required secret names were verified present without reading their values. After separate user approval, the isolated recovery project was reset again; an independent table inventory reports no public application tables. No credential value was read, logged, or recorded.

## Authoritative P0 recovery closure update — 25 August 2026

The obsolete legacy-key-length guard was corrected in GitHub commit `bd17e420f7d67d85c339860a7e341d62099f2f41` (`fix(recovery): accept current API key formats`). The guard now accepts current Supabase `sb_publishable_*` / `sb_secret_*` credentials as well as legacy JWT-format keys without reading or recording any key value.

After a separate user approval, the isolated recovery project was reset to an empty state and independently verified to have no public application tables. The protected workflow `production-free-tier-recovery-rehearsal.yml` was then dispatched from `main` with its required confirmation phrase. Following the separate protected `production` approval, GitHub run [`32875657214`](https://github.com/gurupavanyadav/Telugu_Adda_Kitchen/actions/runs/32875657214) / job **Create encrypted export and verify isolated recovery** completed successfully from 17:05:17 UTC to 17:09:40 UTC, an observed end-to-end rehearsal time of **4 minutes 23 seconds**.

| Recovery control | Verified outcome |
| --- | --- |
| Source and target isolation | A read-only logical export ran from production `xwxjxmbafiguwrqbxgoz`; restoration ran only into separately approved recovery `wuliwrflgjfwnftvkynd`. Production was never restored, reset, or overwritten. |
| Export integrity | Role, schema, data, and migration-history exports were created; the bundle was symmetrically encrypted with AES-256; the encrypted-bundle checksum and all four internal export checksums passed during recovery. |
| Target precondition and restoration | The target precondition was zero application migrations. Restoration recreated the migration-history relation, imported **21** tracked migrations, and verified all six core relations: `addresses`, `dishes`, `orders`, `order_items`, `profiles`, and `user_roles`. |
| Authorization controls | The hosted policy/grant inventory passed. The restored state retained no client-facing execution grant for `public.handle_new_user()`; the workflow also removed target-default `PUBLIC` function execution before data import. |
| Recovered-target live security tests | RLS **13/13**, checkout **6/6**, and address RLS **6/6** passed with zero failures. |
| Plaintext handling and evidence | Plaintext exports, decrypted bundles, and extracted recovery files were removed from the runner. Artifact `production-free-tier-encrypted-recovery-evidence` (artifact ID `9573973500`) was uploaded with **90-day** retention and contains the encrypted bundle, checksum, manifest, migration precheck, policy/grant inventory, and outcome report. |

The operator confirmed that the encrypted archive was saved to long-term off-site storage. The specific storage location and all encryption material are intentionally absent from this evidence record. The GitHub artifact is retained for 90 days as supporting evidence rather than the sole long-term custody location.

After a separate user approval, only the recovery project was paused and only staging was restored. The Supabase dashboard confirmed `delivery-app-production-recovery-drill` is **paused** and `delivery-app-staging` is **Healthy** on nano compute with expected migration `revoke_handle_new_user_execute`. Production remained untouched throughout. The detailed service-state note is `staging-restoration-status-2026-08-25.md`.

**P0 recovery decision:** The required production encrypted logical export and isolated restoration rehearsal is now complete. The remaining operational residual risk is the selected Free-tier model: it is a logical, manually initiated recovery point rather than continuous point-in-time recovery. Potential data loss is bounded by the elapsed time since the latest retained encrypted export, so the operator must continue the documented backup cadence and preserve the passphrase in a password manager.

# Telugu Adda Kitchen — P0 Completion Tracker

**Status as of 25 August 2026:** **All defined P0 implementation, production-verification, and recovery-rehearsal tasks are complete.** P1 work remains explicitly out of scope.

## Completed P0 controls

- [x] Remove the unsafe Supabase configuration fallback; add configuration regression coverage; and run focused build, type-check, lint, and configuration verification.
- [x] Harden order placement through the server-authoritative RPC, idempotency behavior, protected order-status transitions, and supporting live test coverage.
- [x] Define and enforce the approved single trusted restaurant-operator data boundary with least-privilege fulfillment access.
- [x] Apply the immutable production migration chain through protected production run `32836755375` and verify hosted migration history, policy, and grant inventory.
- [x] Apply forward-only production migration `20260825000000_revoke_handle_new_user_execute.sql` through protected run `32849621528`; direct client-facing execution of `public.handle_new_user()` is revoked while the Auth trigger remains intact.
- [x] Complete separately approved production live verification in run `32851577643` / job `97813524079`; retained evidence covers isolated-fixture RLS, checkout, and address controls.
- [x] Publish recovery corrections through commit `bd17e420f7d67d85c339860a7e341d62099f2f41`, including empty-target migration-history bootstrap, source function-execution posture, protected recovery credentials, and current Supabase key-format validation.
- [x] Create an encrypted production logical recovery point; verify AES-256 encryption and bundle/export checksums; and remove runner plaintext after use.
- [x] Perform the separately approved isolated restoration rehearsal in GitHub run `32875657214`; verify 21 migration-history entries, six core relations, hosted policy/grant inventory, RLS **13/13**, checkout **6/6**, and address RLS **6/6**.
- [x] Retain the encrypted recovery-evidence artifact for 90 days and record operator-confirmed long-term off-site encrypted archive custody without recording its location or any encryption material.
- [x] Pause only `delivery-app-production-recovery-drill` after the rehearsal and restore only `delivery-app-staging`; the staging dashboard reports Healthy and production remains unchanged.
- [x] Consolidate final P0 evidence and closure documentation.

## Ongoing operational residuals, not P0 implementation tasks

| Item | Owner action |
| --- | --- |
| Free-tier recovery-point freshness | Continue the documented encrypted logical-export cadence. There is no point-in-time recovery; the possible data-loss window equals time since the latest retained export. |
| Encryption material | Keep the backup passphrase only in the approved password manager or equivalent secure vault; never add it to repository content, issue trackers, logs, or chat. |
| Artifact retention | GitHub evidence artifact `production-free-tier-encrypted-recovery-evidence` expires after 90 days. Maintain the separate long-term encrypted archive. |
| Staging telemetry | Staging is Healthy. Perform ordinary log triage before using it for future release work; no P1 remediation has been initiated here. |

## Scope boundary

No P1 backlog item is marked complete by this tracker. Any future marketplace/multi-operator model, continuous/PITR recovery requirement, privacy acceptance, accessibility acceptance, dependency modernization, observability/on-call work, or product acceptance must be planned and approved separately.

## Current requested assessment

- [x] Complete a non-invasive deep code, dependency, workflow, Supabase-configuration, and test-coverage audit; report the current project status without changing application code, migrations, secrets, GitHub settings, or Supabase environments. Report: `reports/telugu-adda-kitchen-deep-audit-status-2026-08-25.md` in the isolated audit checkout.

## Current requested documentation

- [x] Rewrite the root repository `README.md` as the latest detailed guide, accurately distinguishing completed P0 controls from remaining public-launch hardening work and preserving the no-secrets rule. Updated file: `README.md` in the isolated audit checkout.
- [ ] Publish a documentation-only `main`-branch commit containing the rewritten README, final P0 closure evidence, audit/status records, and tracker updates; verify that no secrets, exports, application code, migrations, or protected configuration are included.

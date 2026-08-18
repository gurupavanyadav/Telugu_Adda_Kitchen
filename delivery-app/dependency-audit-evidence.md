# Dependency Audit Evidence

## Baseline captured 2026-08-18

`npm audit --audit-level=moderate --omit=dev --json` identified one production high-severity transitive dependency finding: `ws` 8.18.3, reached through `@supabase/supabase-js` → `@supabase/realtime-js`.

The affected advisory ranges were `>=8.0.0 <8.20.1` for uninitialized-memory disclosure and `>=8.0.0 <8.21.0` for memory-exhaustion denial of service. The audit reported a fixed version was available.

`@supabase/realtime-js` 2.15.5 declares `ws` with the compatible range `^8.18.2`; `ws` 8.21.0 is therefore a compatible fixed release. The repository will use a narrow npm override and refreshed lockfile rather than an unreviewed parent-package upgrade.

## Required final evidence

After the lockfile change, rerun `npm ci`, `npm audit --audit-level=moderate --omit=dev`, the type-check, lint, production build, and Docker-backed RLS/checkout suites. Attach the clean audit output to the release record.

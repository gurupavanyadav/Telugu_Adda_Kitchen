# Supabase Storage Security Audit

**Repository:** `delivery-app`

**Assessment type:** Static repository and configuration audit with official Supabase Storage security benchmark review

**Assessment date:** 2026-08-17

**Author:** Manus AI

## Executive summary

The reviewed application currently contains **no application upload/download implementation, bucket declaration, or `storage.objects` policy migration**. This is positive for the present browser attack surface: the client creates only a standard Supabase client with a public anonymous key, and no service-role or S3 credential was found in application code.

However, the repository does not define or test the production Storage control plane. The actual production bucket list, public/private flags, MIME and size restrictions, object policies, signed-URL behavior, and S3 access-key inventory may exist only in the Supabase project dashboard. Consequently, the repository cannot prove that production files are private or that upload paths are tenant-scoped. The highest-priority action is to bring Storage configuration and policies under migration control, then add authenticated object-policy tests to the existing CI workflow.

Supabase documents that Storage access is enforced through RLS policies on `storage.objects`, with uploads denied by default unless an appropriate policy exists [1]. Supabase also documents that S3 access keys provide broad bucket operations and bypass `storage.objects` RLS, so they must remain server-only [2].

## Scope and methodology

The audit covered all tracked SQL migrations, Supabase configuration, generated Supabase metadata, frontend Supabase client initialization, upload/download URL calls, CI workflow credential handling, ignore rules, and storage-related filenames. The audit searched for bucket creation, `storage.objects` and `storage.buckets` policies, `upload`, `download`, `remove`, `createSignedUrl`, `createPublicUrl`, S3 credentials, and service-role credentials.

The review did not log into or mutate the linked Supabase project, enumerate production bucket contents, issue signed URLs, attempt uploads, or test S3 credentials. Those actions require an approved staging or production-read-only assessment window. The findings below therefore distinguish **confirmed repository facts** from **production controls that remain unverified**.

## Asset inventory

| Asset or control | Repository finding | Security implication |
|---|---|---|
| Storage service | Enabled in `supabase/config.toml:115-118`; global local file-size limit is `50MiB`. | Storage is available, but no bucket-specific policy is defined in code. |
| S3 protocol | Enabled in `supabase/config.toml:127-129`. | S3 credentials, if issued, must be treated as server-only high-privilege secrets. |
| Bucket definitions | No `storage.buckets` insert or bucket declaration exists in the migrations. | Production bucket configuration may drift outside Git and is not reproducible. |
| Object policies | No `storage.objects` policy exists in the migrations. | The repository cannot demonstrate owner-scoped upload, read, update, or delete behavior. |
| Browser upload/download code | No `supabase.storage` call, upload helper, signed URL, public URL, or raw Storage fetch was found under `src`. | No active application upload path was identified. |
| Client credentials | `src/lib/supabase.ts:3-14` uses the public anonymous key only. | This is acceptable for browser use, assuming Storage policies are least-privilege. |
| Privileged credentials | No service-role, S3 secret, AWS key, or private key was found in tracked source. | No confirmed credential exposure in application code. |
| CI Storage tests | Existing RLS workflow resets and lints the database but has no bucket fixture or `storage.objects` test. | Storage regressions would not currently block deployment. |
| Generated metadata | `supabase/.temp/linked-project.json` and `supabase/.temp/pooler-url` are tracked. | Project identity and a passwordless connection endpoint are disclosed; generated metadata should not be versioned. |

## Severity-ranked findings

### STO-01 — High, conditional: Production Storage configuration and object policies are not represented as code

**Evidence.** The migration directory contains no `storage.buckets`, `storage.objects`, or `bucket_id` statements. `supabase/config.toml` only enables the local Storage service and sets a global 50MiB limit; it does not define a production bucket or object policy. No frontend Storage call was found.

**Impact.** The production project may contain buckets or policies that are absent from the reviewed repository. If a bucket is public, any person who obtains an object URL can read its contents. If an object policy uses a broad `authenticated` predicate, any signed-in user may read or mutate other users’ files. If an upload policy does not bind the first path segment to `auth.uid()`, users may write into another user’s namespace. The lack of code ownership also makes review, rollback, disaster recovery, and CI reproduction incomplete.

**Status.** The configuration gap is confirmed. Actual production exposure is unverified and must be checked with the verification SQL below.

**Remediation.** Define every production bucket in a timestamped migration, default sensitive buckets to `public = false`, set a bucket-specific size and MIME allowlist, and create explicit `storage.objects` policies for each operation. Do not rely on a dashboard-only configuration. Add a fresh-database Storage fixture and authenticated policy tests to CI.

### STO-02 — High, conditional: S3-compatible access is enabled and could bypass Storage RLS if credentials are mishandled

**Evidence.** `supabase/config.toml:127-129` enables the S3 protocol. No S3 credential was found in tracked code or workflow files, which is positive. The repository does not document who owns S3 keys, where they are stored, their scope, rotation interval, or whether any client, preview deployment, or CI job receives them.

**Impact.** Supabase documents that S3 access keys have broad bucket capabilities and bypass `storage.objects` RLS [2]. A leaked or over-shared S3 key would therefore defeat the application’s object-level policies and could expose, overwrite, or delete files across all buckets. This risk applies even if the Postgres RLS policies are correct.

**Remediation.** Inventory all S3 keys in the Supabase project, revoke unknown or unused keys, rotate keys after any possible exposure, and store active keys only in a server-side secret manager. Never place them in `VITE_*` variables, browser bundles, pull-request environments, client-side tests, or GitHub logs. Prefer the Supabase client with user sessions for browser access and use short-lived signed upload/download URLs when a server-mediated workflow is needed.

### STO-03 — Medium: Storage behavior is absent from automated security testing

**Evidence.** The existing RLS workflow runs `supabase db reset --local`, `supabase db lint --local`, `npm run test:rls`, `npm run test:checkout`, and `npm run test:address-rls`, but no test creates a bucket or exercises `storage.objects` with anonymous, customer, vendor, or admin sessions.

**Impact.** A future upload feature could introduce cross-user reads, path traversal through object names, overwrite of another user’s file, unrestricted deletes, public buckets, or permissive MIME/size settings without failing CI.

**Remediation.** Add a Storage fixture migration and a test suite with at least the following cases: anonymous read denial for private objects; customer own-object read/upload/update/delete success; cross-customer read/upload/update/delete denial; path-prefix mismatch denial; vendor/admin denial unless explicitly required; and rejection of unsupported MIME or oversized objects at the bucket boundary. Use a service-role client only for fixture setup and cleanup, never as the client under test.

### STO-04 — Medium, conditional: Only a global file-size limit is configured; no bucket-specific MIME and size controls are defined

**Evidence.** `supabase/config.toml:117-118` sets a global local limit of `50MiB`. No bucket-level `allowed_mime_types` or `file_size_limit` is present, and no production bucket declaration exists.

**Impact.** If an upload feature is enabled without additional controls, users may upload unnecessarily large files or unexpected content types. This can increase storage and egress cost, create unsafe content-serving behavior, and complicate malware/content scanning. MIME declarations alone are not content validation, because a client can forge a MIME header.

**Remediation.** Configure each bucket with the smallest practical size and MIME allowlist. Use server-side content inspection for files that will be rendered or processed, generate safe object names rather than trusting original filenames, and serve untrusted content from a separate origin or with download-oriented response headers where appropriate. Treat bucket restrictions as defense-in-depth, not as an authorization substitute.

### STO-05 — Medium/Low: Generated Supabase metadata containing project and connection identifiers is tracked

**Evidence.** `supabase/.temp/linked-project.json`, `supabase/.temp/project-ref`, and `supabase/.temp/pooler-url` are tracked by Git. The pooler URL contains a project-specific PostgreSQL endpoint but no password. The `.gitignore` does not ignore `supabase/.temp`.

**Impact.** The endpoint and project identity do not by themselves grant access, but they increase reconnaissance value and create a risk that future generated files containing credentials are committed. This also causes local/project metadata to drift into source-controlled artifacts.

**Remediation.** Add `supabase/.temp/` to `.gitignore`, remove generated metadata from the repository, and purge it from Git history if the project’s policy treats infrastructure identifiers as sensitive. Confirm that no passwords or tokens were ever stored in those files. Rotate credentials if any historical commit contains a secret.

### STO-06 — Informational positive control: No active client upload/download attack surface was found

No browser-side Storage call, public URL construction, signed URL creation, raw Storage fetch, file picker, or upload component was found. This reduces current risk but does not replace a production Storage inventory. If file upload is added later, it must be implemented together with the bucket migration, object policies, tests, and CI gate described above.

## Production verification SQL

Run these queries through an approved read-only administrative connection in staging first, then production. Do not run them with a customer’s browser session.

```sql
-- 1. Inventory buckets and bucket-level exposure/limits.
select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
from storage.buckets
order by id;

-- 2. Inventory every Storage object policy.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename in ('objects', 'buckets')
order by tablename, policyname;

-- 3. Identify broad policies that are commonly unsafe for private objects.
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and (
    qual ilike '%true%'
    or with_check ilike '%true%'
    or array_to_string(roles, ',') in ('{public}', '{anon}', '{authenticated}')
  );

-- 4. Confirm RLS and grants on Storage tables.
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'storage'
  and c.relname in ('objects', 'buckets');

select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'storage'
  and table_name in ('objects', 'buckets')
order by table_name, grantee, privilege_type;

-- 5. Look for object paths that do not begin with a user namespace.
-- Adapt the prefix convention to the application’s chosen path contract.
select bucket_id, name, owner_id, created_at
from storage.objects
where bucket_id in ('avatars', 'private-files')
  and (storage.foldername(name))[1] !~ '^[0-9a-fA-F-]{36}$'
limit 200;
```

## Reference policy pattern for a private user-owned bucket

The following is a template, not a drop-in production migration. Replace the bucket name and path contract after reviewing the application’s intended file types. The first path component is the authenticated user ID, and the bucket is private.

```sql
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'private-files',
  'private-files',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'application/pdf']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "private files: owner read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'private-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "private files: owner upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'private-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "private files: owner update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'private-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'private-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "private files: owner delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'private-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
```

The application should use non-overwriting uploads by default. If overwrite behavior is required, the `SELECT` and `UPDATE` permissions must be reviewed together; Supabase’s documentation notes that overwriting requires more than an `INSERT` policy [1]. Avoid exposing object names based directly on untrusted filenames, and use signed URLs for private downloads rather than making the bucket public.

## Recommended remediation sequence

| Priority | Action | Exit criterion |
|---|---|---|
| P0 | Inventory hosted buckets, policies, and S3 keys using the verification queries and dashboard review. | Every production bucket has an owner, purpose, visibility decision, policy owner, and key inventory. |
| P1 | Add bucket and `storage.objects` policy migrations to Git. | A fresh database reproduces the intended Storage configuration. |
| P1 | Add Storage tests to the existing CI workflow. | CI proves customer isolation, anonymous denial, path binding, operation separation, and bucket limits. |
| P1 | Remove and ignore tracked `supabase/.temp` metadata. | No generated connection metadata is versioned; history is reviewed for secrets. |
| P2 | Add content scanning and safe-serving controls before accepting user files. | Files are validated server-side and served with an explicit content-disposition/origin policy. |
| P2 | Establish S3 key rotation and access review. | No client/preview job has S3 keys; owners and rotation dates are recorded. |

## Validation limitations

The audit was static and non-destructive. No production bucket was enumerated, no object was downloaded, no upload was attempted, and no S3 credential was used. Because the repository has no bucket or policy migration, the actual production Storage state remains the critical unresolved verification item. The local Supabase linter and authenticated Storage tests should be run in a Docker-enabled staging environment after the bucket configuration is brought under migration control.

## References

[1]: https://supabase.com/docs/guides/storage/security/access-control — Supabase, “Storage Access Control.”

[2]: https://supabase.com/docs/guides/storage/s3/authentication — Supabase, “S3 Authentication.”

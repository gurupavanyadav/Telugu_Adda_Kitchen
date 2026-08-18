# Non-Order Database RLS Review

**Scope.** This review covers every database table outside the checkout and order domain in the reviewed project: `profiles`, `dishes`, `daily_menus`, `addresses`, and `user_roles`. It compares the migration history with frontend access paths and checks RLS enablement, policy predicates, grants, security-definer helpers, and legacy role drift.

The review is static against the repository’s migration chain. No production database was contacted. The local Supabase linter could not run because the sandbox does not have the `supabase` CLI or a running PostgreSQL/Docker environment.

## Executive summary

The non-order model has one material active exposure and one important policy-drift concern. The remaining tables are RLS-enabled, and customer address CRUD plus role-table access are owner-scoped. Catalog writes are vendor-only after the vendor-boundary migration. However, a legacy `profiles.role = 'admin'` policy still allows any surviving legacy admin identity to read every customer address, exposing hostel, room, and phone information. The project also maintains two role systems—legacy `profiles.role` and canonical `user_roles.role = 'vendor'`—which creates avoidable authorization ambiguity.

| ID | Severity | Area | Finding | Status |
|---|---|---|---|---|
| NRL-01 | High, conditional | `addresses` | Legacy admin policy still grants all-address read access to users whose legacy profile role is `admin`; the canonical vendor boundary does not remove it. | Confirmed in migration chain; live account exposure requires database verification |
| NRL-02 | Medium | `profiles` / role model | Legacy `profiles.role` admin policy and canonical `user_roles` vendor policy coexist, creating role-model drift and inconsistent authorization semantics. | Confirmed policy drift |
| NRL-03 | Low | `dishes`, `daily_menus` | Public catalog reads are intentionally broad, while vendor `FOR ALL` policies permit vendors to mutate the full catalog. This is acceptable only if every vendor is fully trusted to edit all menu data. | Design-risk / requires business confirmation |
| NRL-04 | Informational | `user_roles` | RLS and policy coverage are restrictive: users can read only their own role, and no client role has write policies. | No vulnerability found |
| NRL-05 | Informational | `addresses` | Customer address CRUD is correctly owner-scoped with both `USING` and `WITH CHECK` predicates on updates. | No vulnerability found |

## Findings

### NRL-01 — Legacy admins can read every customer address

**Severity: High, conditional.** The initial schema creates an address policy named `Admins can view all addresses` with a predicate that checks `profiles.role = 'admin'`.

```sql
create policy "Admins can view all addresses" on addresses for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
```

The newer restaurant-schema migration recreates the owner-scoped address policies but does not drop this legacy admin policy. The vendor-boundary migration removes obsolete admin policies for dishes and daily menus, while later order migrations explicitly remove admin policies for orders and order items. No corresponding drop for `Admins can view all addresses` appears in the migration chain. Because PostgreSQL combines permissive policies with `OR`, a surviving legacy admin identity can select all address rows despite the owner-scoped policy.

The exposed fields include `hostel_name`, `room_number`, and `phone`, which are customer delivery data. This is not reachable by ordinary customers unless they can obtain the legacy admin role; nevertheless, the policy is active for any existing legacy admin account and conflicts with the canonical vendor model.

**Recommended remediation.** If the application no longer supports legacy admins, remove the policy and deprecate the legacy role column:

```sql
DROP POLICY IF EXISTS "Admins can view all addresses" ON public.addresses;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
```

If a privileged operations role is still required, replace the legacy predicate with an explicit role table and a narrowly scoped RPC or view that returns only the fields required for operations. Do not use the mutable `profiles.role` column as a second authorization source.

### NRL-02 — Dual role models create authorization drift

**Severity: Medium.** The initial schema defines `profiles.role` with `customer` and `admin` values and uses it in broad policies for profiles, addresses, dishes, daily menus, orders, and order items. The newer role-boundary migration introduces `user_roles`, whose only permitted value is `vendor`, and `private.is_vendor()` checks that table under a security-definer function.

The canonical frontend uses `user_roles` and the `vendor` role, but the legacy `profiles` policies are not uniformly removed. Some are explicitly dropped for dishes, daily menus, orders, and order items; the address and profile-wide admin policies remain in the migration history. This makes authorization depend on which policy names happened to be removed rather than on one coherent role model.

**Recommended remediation.** Adopt `user_roles` as the only authorization source. Remove the legacy admin policies, prohibit client access to role mutation, and add a one-time data migration that maps any intentionally retained legacy admins to an explicitly documented role. After verification, remove or make `profiles.role` non-authoritative.

A defensive migration should include at least:

```sql
DROP POLICY IF EXISTS "Admins can view all addresses" ON public.addresses;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Optional after the data migration and application cutover:
-- ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;
```

Do not execute the optional column drop until all application code, policies, reports, and operational tooling have been migrated.

### NRL-03 — Vendor catalog policy is broad by design

**Severity: Low, design-risk.** The vendor-boundary migration replaces authenticated-wide catalog mutation policies with `vendor_manage_dishes` and `vendor_manage_daily_menus`, both defined as `FOR ALL TO authenticated` with `private.is_vendor()` in `USING` and `WITH CHECK`. This correctly blocks ordinary customers, but any vendor can insert, update, or delete every dish and every daily-menu row.

This is appropriate for a single trusted restaurant operator. It becomes an authorization concern if the system later introduces multiple restaurants, branch managers, or vendors with separate catalogs. In that model, a `vendor_id` or tenant key is required and every policy must constrain rows to the caller’s tenant.

**Recommended remediation if the product becomes multi-vendor.** Add a tenant/restaurant key to catalog tables and change the predicate to an ownership check, for example:

```sql
USING (private.is_vendor_for(restaurant_id))
WITH CHECK (private.is_vendor_for(restaurant_id))
```

The helper must use a trusted role-membership table and an empty `search_path`.

## Tables with no missing-RLS issue found

| Table | RLS and policy result | Frontend use |
|---|---|---|
| `user_roles` | RLS enabled; authenticated users can select only their own row; no client insert/update/delete policies found. | Auth context reads the current user’s role. |
| `addresses` | RLS enabled; select, insert, update, and delete are constrained by `auth.uid() = user_id`; update has both `USING` and `WITH CHECK`. | Profile and checkout pages manage only the signed-in user’s addresses. |
| `dishes` | Public `SELECT` is intentional for menu browsing; mutation is vendor-only after policy replacement. | Menu pages read dishes; vendor dashboard manages catalog rows. |
| `daily_menus` | Public `SELECT` is intentional; mutation is vendor-only after policy replacement. | Menu page reads today’s menu; vendor dashboard manages menu rows. |
| `profiles` | RLS enabled; users can read their own profile; no client write policies found. The remaining admin-wide read policy is covered by NRL-01/NRL-02. | The current frontend does not use `profiles` for authorization. |

## Recommended regression tests

The CI suite should add the following non-order cases alongside the existing order tests:

| Test | Expected result |
|---|---|
| Customer A reads Customer B’s address by ID | No row returned. |
| Customer A updates Customer B’s address by ID | Error or zero affected rows; Customer B’s row remains unchanged. |
| Customer A inserts an address with Customer B’s `user_id` | RLS denial. |
| Customer A inserts or updates a dish | RLS denial. |
| Customer A inserts or deletes a daily-menu row | RLS denial. |
| Customer A inserts or updates `user_roles` | RLS denial. |
| Vendor reads and manages catalog rows | Allowed only if the single-operator vendor model is intended. |
| Legacy `profiles.role = 'admin'` session reads addresses | Must be denied after NRL-01 remediation. |

## Validation limitations

The repository search confirmed that all discovered tables have explicit `ENABLE ROW LEVEL SECURITY` statements and that the primary frontend calls are consistent with owner-scoped address access and public catalog reads. Static inspection cannot prove the effective policy set in a live database if migrations were applied out of order, edited after deployment, or supplemented by dashboard-created policies. Apply the remediation in a staging database, run `supabase db reset --local`, execute the authenticated RLS suite, and inspect `pg_policies`, `information_schema.role_table_grants`, and representative authenticated sessions before production rollout.

## Evidence references

[1]: `supabase/migrations/0001_initial_schema.sql` — legacy profiles, admin policies, and initial non-order table policies.
[2]: `supabase/migrations/20260807210118_create_restaurant_schema.sql` — current dishes, daily menus, and addresses schema plus owner/public policies.
[3]: `supabase/migrations/20260808205313_vendor_auth_boundary.sql` — canonical vendor role table, secure helper, and catalog policy replacement.
[4]: `src/features/auth/context/auth.tsx` — frontend role lookup through `user_roles`.
[5]: `src/features/profile/pages/ProfilePage.tsx` — owner-filtered address operations.
[6]: `src/features/menu/pages/MenuPage.tsx` — public daily-menu read path.
[7]: `src/features/admin/pages/AdminPage.tsx` — vendor catalog management path.

# Delivery App Backend Security Vulnerability Scan

**Scope:** Supabase migrations and client-callable database paths in the reviewed, patched project tree. The scan covers RLS policies, grants, `SECURITY DEFINER` functions, triggers, order/menu/address/profile access, and frontend database invocations. It does not include a live authenticated penetration test because no staging credentials or local PostgreSQL instance were available.

## Executive assessment

The database has a sound foundation in several areas: RLS is enabled on the principal application tables; the canonical `user_roles` table restricts role reads to the current user; the vendor predicate uses a fixed `search_path`; and the patched `create_order` function validates catalog prices, availability, quantity, delivery-address ownership, and fulfillment fees.

However, the intended **RPC-only order boundary is not enforced by the remaining RLS policies**. The later hardening migration drops legacy policy names, while newer policies with different names remain active. As a result, an authenticated customer can still create, modify, and delete order records and line items directly, bypassing the hardened order RPC. This is the highest-priority issue because it defeats the main integrity control implemented in the previous patch.

| ID | Severity | Finding | Status |
|---|---|---|---|
| SEC-01 | **High** | Customer direct-write policies remain active for orders and order items. | Confirmed by migration-chain analysis |
| SEC-02 | **High** | Any authenticated user can mutate dishes and daily menus in an intermediate migration state; the final vendor migration removes those exact policies, but deployment drift can reintroduce the exposure. | Historical/intermediate-state exposure; verify live schema |
| SEC-03 | **High** | Vendor order updates are unrestricted, allowing a vendor to alter ownership, totals, fulfillment data, and other core fields. | Confirmed by trigger and RLS definitions |
| SEC-04 | **Medium** | Customers can delete their own orders and line items, undermining auditability and order history. | Confirmed by RLS definitions |
| SEC-05 | **Medium** | Legacy `profiles.role = 'admin'` policies coexist with the canonical `user_roles.role = 'vendor'` model. | Confirmed policy drift; practical exposure depends on live rows |
| SEC-06 | **Low** | Customer order updates are not column-allowlisted; audit timestamps and future non-core fields can be changed. | Confirmed by trigger logic |
| SEC-07 | **Informational** | No additional edge functions or custom HTTP backend endpoints were found; the exposed backend surface is Supabase Auth, PostgREST table access, and the order RPC. | Confirmed by source scan |

## Findings

### SEC-01 — High: direct customer writes bypass the hardened order RPC

The restaurant-schema migration creates `insert_own_orders`, `update_own_orders`, and `delete_own_orders` policies, followed by equivalent insert, update, and delete policies for `order_items`.[1] The earlier RPC hardening migration attempts to remove direct inserts, but it drops only the legacy policy names `Users can insert their own orders` and `Users can insert order items for their own orders`.[2] It does not remove the newer `insert_own_orders` or `insert_own_order_items` policies.

This means an authenticated customer can bypass `create_order` and directly insert an order whose totals, status, fulfillment data, and address snapshot are chosen by the client, then insert arbitrary line items. The customer can also update and delete the order and its line items through the remaining own-record policies. The hardened RPC’s catalog-price and fee checks therefore do not protect the actual database write surface.

**Impact:** An attacker can create inconsistent or fraudulent order records, alter item prices and quantities after checkout, remove line items, and potentially reserve arbitrary unique order numbers. This is an integrity and auditability failure even though RLS prevents access to other users’ records.

**Recommended fix:** Add a new migration that explicitly drops all customer `INSERT`, `UPDATE`, and `DELETE` policies on `orders` and `order_items`. Retain only customer `SELECT` on their own orders/items, and permit customer order cancellation or note edits through a narrowly scoped RPC or a trigger-backed, column-allowlisted update path. The migration should use the exact current policy names, not only historical names.

A minimal policy-removal section is:

```sql
DROP POLICY IF EXISTS insert_own_orders ON public.orders;
DROP POLICY IF EXISTS update_own_orders ON public.orders;
DROP POLICY IF EXISTS delete_own_orders ON public.orders;
DROP POLICY IF EXISTS insert_own_order_items ON public.order_items;
DROP POLICY IF EXISTS update_own_order_items ON public.order_items;
DROP POLICY IF EXISTS delete_own_order_items ON public.order_items;

-- Keep read access only.
-- Customer mutations should use dedicated RPCs with explicit field checks.
```

### SEC-02 — High: authenticated-wide menu mutation policy exists in the migration chain

The restaurant-schema migration creates `auth_manage_dishes` and `auth_manage_daily_menus` with `FOR ALL TO authenticated USING (true) WITH CHECK (true)`.[3] That policy grants every signed-in user full insert, update, and delete access to the dish catalog and daily menu.

The later vendor-boundary migration drops those exact policy names and creates vendor-only policies using `private.is_vendor()`.[4] Therefore, the **final ordered migration state appears to correct this issue**, provided every migration has been applied successfully and no deployment stopped between these migrations. The intermediate policy is still dangerous because a partial, out-of-order, or failed deployment leaves the application with unrestricted catalog mutation.

**Recommended fix:** Add a migration-time assertion or CI database check that fails when any authenticated-wide `FOR ALL` policy remains on `dishes` or `daily_menus`. Also verify the live database through `pg_policies` after deployment. Avoid relying on policy replacement as the only control; explicitly revoke table privileges from `authenticated` if the project uses grants that are broader than the intended operations.

### SEC-03 — High: vendor order updates are unrestricted

The vendor policy grants `UPDATE` on every order to any session for which `private.is_vendor()` returns true.[5] The `secure_order_updates` trigger immediately returns `NEW` for vendors, bypassing all customer field restrictions.[6] Consequently, a vendor can modify `user_id`, `items_total`, `delivery_fee`, `grand_total`, `fulfillment_type`, `delivery_address`, `order_number`, timestamps, notes, and status.

**Impact:** A compromised or malicious vendor account can transfer an order to another customer, change totals, rewrite the delivery destination, alter the audit trail, or set arbitrary statuses. This may be acceptable only if a vendor is explicitly a fully trusted database administrator; it is not appropriate for a normal restaurant-operations role.

**Recommended fix:** Replace the broad vendor update policy with a restricted update RPC or a trigger that allowlists vendor-editable columns. A typical operational allowlist would include `status` and perhaps `notes`, but not ownership, totals, order number, fulfillment type, or the address snapshot. Enforce valid status transitions in the database, such as `received -> preparing -> out_for_delivery -> delivered`, with cancellation rules defined separately.

### SEC-04 — Medium: customers can delete orders and line items

The schema creates `delete_own_orders` and `delete_own_order_items` policies for authenticated users.[1] These policies are independent of the order trigger and allow a customer to remove their own order and its items at any time. Because `order_items` references `orders ... ON DELETE CASCADE`, deleting an order also deletes its line items.[1]

**Impact:** Order history can disappear without a cancellation event, weakening customer support, financial reconciliation, and audit evidence. The issue does not expose another user’s data, but it permits destructive tampering with records that should generally be append-only or retained.

**Recommended fix:** Remove customer `DELETE` policies. Use a cancellation update or a dedicated cancellation RPC while retaining the record. If privacy law or a formal account-deletion workflow requires erasure, perform it through a controlled server-side process with appropriate retention and audit rules.

### SEC-05 — Medium: legacy admin authorization remains in the migration surface

The initial schema contains policies that consult `profiles.role = 'admin'`, including address, order, dish, and daily-menu access.[7] The newer authorization model creates `user_roles.role = 'vendor'` and uses `private.is_vendor()` for menu and vendor order access.[4] The frontend was corrected in the previous patch to read `user_roles`, but the migration chain still contains the parallel `profiles` role model and policy names.

Some legacy policies are explicitly dropped by later migrations, but the chain is difficult to audit and leaves a risk that a missed policy or a manually created `profiles.role = 'admin'` row grants unintended access. The address policy named `Admins can view all addresses` is especially sensitive because addresses contain phone numbers and delivery locations.[7]

**Recommended fix:** Consolidate authorization on `user_roles`, remove or deprecate `profiles.role`, and add a final migration that explicitly drops every legacy admin policy. Confirm the effective live policy set using `pg_policies`, rather than relying only on migration text.

### SEC-06 — Low: customer order updates are not column-allowlisted

The customer branch of `secure_order_updates` blocks totals, ownership, order number, fulfillment type, and delivery address, and allows notes plus a received-to-cancelled status transition.[6] It does not reject changes to `created_at`, `updated_at`, or any future columns that are not listed in the protected set.

**Impact:** A customer can potentially tamper with audit timestamps or any newly added column until the trigger is updated. This is a defense-in-depth and audit-integrity concern.

**Recommended fix:** Use a positive allowlist: compare every column except `notes` and the explicitly permitted cancellation status, or move customer edits to a dedicated RPC that updates only those columns. Set `updated_at` in a trusted trigger rather than accepting client values.

## Positive controls observed

The scan found several controls that should be retained. The `user_roles` table has RLS and allows each authenticated user to read only their own role.[4] The `private.is_vendor()` function is `SECURITY DEFINER` with `SET search_path = ''` and schema-qualified table references.[4] The order-update trigger also sets a fixed search path.[6] The patched order RPC performs explicit caller authentication, user-owned address lookup, dish availability checks, canonical customization-price lookup, quantity bounds, and server-side persistence of monetary values.

The browser client contains a Supabase URL and anonymous key, but those are intended public-client credentials rather than service-role secrets. The risk is deployment coupling to a specific project, not exposure of an administrative key.[8]

## Validation performed and limitations

| Check | Result |
|---|---|
| Migration and policy inventory | Completed across all files in `supabase/migrations` |
| Client backend-call inventory | Completed; no `supabase.functions.invoke`, custom API client, or raw backend `fetch` endpoint was found |
| Static policy/grant review | Completed; direct-write and vendor-wide update paths identified |
| Supabase local database lint | Not executable; no local PostgreSQL was running, and the linter reported connection refusal on `127.0.0.1:54322` |
| Live `pg_policies` verification | Not performed; no project credentials or staging database session was provided |
| Authenticated exploit test | Not performed; no test accounts were available |

The two high-severity policy findings should be treated as confirmed from the repository’s migration chain, while the exact live exposure should be verified immediately against the deployed database. The first remediation to apply is SEC-01 because it nullifies the previous order-RPC hardening.

## Recommended remediation order

1. Remove the current customer insert, update, and delete policies on `orders` and `order_items`; retain read-only ownership policies and add dedicated cancellation/note-edit RPCs.
2. Restrict vendor order updates to an explicit operational field allowlist and validate status transitions.
3. Verify the live `dishes` and `daily_menus` policy set and add a CI assertion preventing authenticated-wide `FOR ALL` policies.
4. Remove legacy `profiles.role = 'admin'` policies and consolidate all authorization on `user_roles.role = 'vendor'`.
5. Make customer order mutation logic positive/column-allowlisted and protect timestamps with trusted triggers.

## References

[1]: file:///home/ubuntu/delivery-app-review/delivery-app/supabase/migrations/20260807210118_create_restaurant_schema.sql "Restaurant schema migration: order and order-item RLS policies"

[2]: file:///home/ubuntu/delivery-app-review/delivery-app/supabase/migrations/20260809000001_secure_order_rpc.sql "Initial order RPC hardening migration and legacy policy cleanup"

[3]: file:///home/ubuntu/delivery-app-review/delivery-app/supabase/migrations/20260807210118_create_restaurant_schema.sql "Restaurant schema migration: authenticated-wide menu policies"

[4]: file:///home/ubuntu/delivery-app-review/delivery-app/supabase/migrations/20260808205313_vendor_auth_boundary.sql "Vendor authorization boundary and role predicates"

[5]: file:///home/ubuntu/delivery-app-review/delivery-app/supabase/migrations/20260809000002_vendor_order_updates.sql "Vendor order RLS policies"

[6]: file:///home/ubuntu/delivery-app-review/delivery-app/supabase/migrations/20260809000002_vendor_order_updates.sql "Order update trigger"

[7]: file:///home/ubuntu/delivery-app-review/delivery-app/supabase/migrations/0001_initial_schema.sql "Initial schema and legacy admin policies"

[8]: file:///home/ubuntu/delivery-app-review/delivery-app/src/lib/supabase.ts "Browser Supabase client configuration"

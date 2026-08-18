-- Remove the legacy profiles.role authorization path and close NRL-01.
--
-- Canonical authorization is now public.user_roles. Supported privileged roles
-- are explicitly provisioned `vendor` and `admin` rows. Neither role receives a
-- broad address policy: address access remains owner-scoped to protect PII.
-- This migration is intentionally additive and does not drop profiles.role
-- immediately, because existing operational data may still contain the legacy column.

-- Remove the policy that allowed any legacy admin profile to read every address.
DROP POLICY IF EXISTS "Admins can view all addresses" ON public.addresses;

-- Remove the legacy admin-wide profile read policy. Users retain self-read.
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Remove legacy admin policies that may still exist on catalog tables in a
-- database that was migrated from an older branch.
DROP POLICY IF EXISTS "Only admins can insert dishes" ON public.dishes;
DROP POLICY IF EXISTS "Only admins can update dishes" ON public.dishes;
DROP POLICY IF EXISTS "Only admins can delete dishes" ON public.dishes;
DROP POLICY IF EXISTS "Only admins can insert daily menus" ON public.daily_menus;
DROP POLICY IF EXISTS "Only admins can update daily menus" ON public.daily_menus;
DROP POLICY IF EXISTS "Only admins can delete daily menus" ON public.daily_menus;

-- Remove any remaining legacy admin order visibility or mutation policies.
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;

-- Make the canonical role table explicit and client-read-only. The existing
-- vendor-boundary migration creates this table with a vendor-only CHECK. This
-- assertion prevents a partially migrated database from accepting an old role.
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check CHECK (role IN ('vendor', 'admin'));

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_role" ON public.user_roles;
CREATE POLICY "users_read_own_role"
ON public.user_roles
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- There are deliberately no INSERT, UPDATE, or DELETE policies for anon or
-- authenticated. Service-role/admin migrations must provision role rows. No
-- address policy is granted to either admin or vendor; addresses remain owner-only.
REVOKE ALL ON TABLE public.user_roles FROM anon, authenticated;
GRANT SELECT ON TABLE public.user_roles TO authenticated;

-- Prevent callers from invoking the role helper anonymously. The helper itself
-- remains callable by authenticated vendor policy evaluation only.
REVOKE ALL ON FUNCTION private.is_vendor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_vendor() TO authenticated;

-- Optional post-cutover cleanup, to be executed only after all operational
-- tooling has migrated away from profiles.role:
-- ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- Verification queries for staging:
-- SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('addresses', 'profiles', 'user_roles')
-- ORDER BY tablename, policyname;
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND table_name = 'user_roles';

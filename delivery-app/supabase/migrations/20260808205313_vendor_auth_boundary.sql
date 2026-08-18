-- 1. Create user_roles table
CREATE TABLE public.user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role = 'vendor'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS and add self-SELECT policy
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_role"
ON public.user_roles
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- 3. Create private schema and is_vendor function
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_vendor()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = (SELECT auth.uid())
      AND role = 'vendor'
  );
$$;

-- Revoke execute from public to prevent direct calling
REVOKE ALL ON FUNCTION private.is_vendor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_vendor() TO authenticated;

-- 4. Remove ALL obsolete menu mutation policies
-- From 20260807210118_create_restaurant_schema.sql
DROP POLICY IF EXISTS "auth_manage_dishes" ON public.dishes;
DROP POLICY IF EXISTS "auth_manage_daily_menus" ON public.daily_menus;

-- From 0001_initial_schema.sql
DROP POLICY IF EXISTS "Only admins can insert dishes" ON public.dishes;
DROP POLICY IF EXISTS "Only admins can update dishes" ON public.dishes;
DROP POLICY IF EXISTS "Only admins can delete dishes" ON public.dishes;
DROP POLICY IF EXISTS "Only admins can insert daily menus" ON public.daily_menus;
DROP POLICY IF EXISTS "Only admins can delete daily menus" ON public.daily_menus;

-- 5. Add vendor-only mutation policies
-- For Dishes
CREATE POLICY "vendor_manage_dishes"
ON public.dishes
FOR ALL
TO authenticated
USING ((SELECT private.is_vendor()))
WITH CHECK ((SELECT private.is_vendor()));

-- For Daily Menus
CREATE POLICY "vendor_manage_daily_menus"
ON public.daily_menus
FOR ALL
TO authenticated
USING ((SELECT private.is_vendor()))
WITH CHECK ((SELECT private.is_vendor()));

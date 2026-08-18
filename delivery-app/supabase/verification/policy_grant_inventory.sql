-- P0-01 protected-environment verification.
-- This script fails when the hosted project is missing a hardened migration,
-- retains a forbidden legacy policy, or exposes the private order writer.

DO $$
DECLARE
  v_missing_migrations text;
  v_forbidden_policies text;
BEGIN
  WITH expected(version) AS (
    VALUES
      ('0001'),
      ('20260807210118'),
      ('20260808205313'),
      ('20260809000000'),
      ('20260809000001'),
      ('20260809000002'),
      ('20260809000003'),
      ('20260816000000'),
      ('20260816000001'),
      ('20260816000002'),
      ('20260816000003'),
      ('20260816000004'),
      ('20260816000005'),
      ('20260816000006'),
      ('20260818000001'),
      ('20260818000002'),
      ('20260818000003'),
      ('20260818000004')
  )
  SELECT string_agg(e.version, ', ' ORDER BY e.version)
  INTO v_missing_migrations
  FROM expected AS e
  LEFT JOIN supabase_migrations.schema_migrations AS m
    ON m.version = e.version
  WHERE m.version IS NULL;

  IF v_missing_migrations IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required hardened migrations: %', v_missing_migrations;
  END IF;

  SELECT string_agg(format('%I.%I:%I', p.schemaname, p.tablename, p.policyname), ', ')
  INTO v_forbidden_policies
  FROM pg_policies AS p
  WHERE p.schemaname = 'public'
    AND p.policyname = ANY (ARRAY[
      'Users can insert their own orders',
      'Users can update their own orders',
      'Users can delete their own orders',
      'insert_own_orders',
      'update_own_orders',
      'delete_own_orders',
      'Users can insert order items for their own orders',
      'Users can update order items for their own orders',
      'Users can delete order items for their own orders',
      'insert_own_order_items',
      'update_own_order_items',
      'delete_own_order_items',
      'Admins can view all addresses',
      'Admins can view all profiles',
      'Admins can view all orders',
      'Admins can update all orders',
      'Admins can view all order items',
      'vendor_update_all_orders',
      'vendor_update_orders',
      'vendor_view_all_orders',
      'vendor_view_all_order_items'
    ]);

  IF v_forbidden_policies IS NOT NULL THEN
    RAISE EXCEPTION 'Forbidden legacy policies remain: %', v_forbidden_policies;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('orders', 'order_items', 'addresses', 'user_roles')
      AND c.relrowsecurity IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'RLS is disabled on one or more protected public tables';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.create_order(text,text,uuid,text,jsonb,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Anonymous callers can execute public.create_order';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.create_order(text,text,uuid,text,jsonb,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authenticated callers cannot execute the required public.create_order RPC';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'private.internal_create_order(text,text,uuid,text,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authenticated callers can execute private.internal_create_order';
  END IF;

  IF has_table_privilege('authenticated', 'public.orders', 'UPDATE') THEN
    RAISE EXCEPTION 'Authenticated callers retain direct UPDATE on public.orders';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.dishes', 'SELECT, UPDATE') THEN
    RAISE EXCEPTION 'Authenticated vendor catalog access is incomplete';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.list_vendor_fulfillment_orders()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authenticated callers cannot execute the required vendor fulfillment list RPC';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.update_vendor_order_fulfillment(uuid,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authenticated callers cannot execute the required vendor fulfillment update RPC';
  END IF;

  IF to_regprocedure('public.create_order(text,text,uuid,text,jsonb)') IS NOT NULL THEN
    RAISE EXCEPTION 'The retired five-argument public.create_order overload remains executable';
  END IF;

  IF NOT (
    has_table_privilege('service_role', 'public.profiles', 'UPDATE')
    AND has_table_privilege('service_role', 'public.user_roles', 'INSERT, DELETE')
    AND has_table_privilege('service_role', 'public.addresses', 'INSERT, SELECT, DELETE')
    AND has_table_privilege('service_role', 'public.dishes', 'INSERT, SELECT, DELETE')
    AND has_table_privilege('service_role', 'public.orders', 'SELECT, DELETE')
  ) THEN
    RAISE EXCEPTION 'Service-role P0 verification fixture privileges are incomplete';
  END IF;
END;
$$;

SELECT
  p.tablename,
  p.policyname,
  p.cmd,
  p.roles
FROM pg_policies AS p
WHERE p.schemaname = 'public'
  AND p.tablename IN ('orders', 'order_items', 'addresses', 'user_roles')
ORDER BY p.tablename, p.policyname;

SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND (
    (grantee = 'service_role' AND table_name IN ('profiles', 'user_roles', 'addresses', 'dishes', 'orders'))
    OR (grantee = 'authenticated' AND table_name = 'dishes')
  )
ORDER BY table_name, privilege_type;

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
      ('20260818000001')
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

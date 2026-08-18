-- Fix SEC-01 and SEC-03.
--
-- SEC-01: Orders and order_items must be written through trusted server-side
-- functions, principally public.create_order. Customers retain read access to
-- their own records but lose direct INSERT/UPDATE/DELETE access.
--
-- SEC-03: Vendors may update only operational fields on orders: status and
-- notes. Ownership, totals, fulfillment data, address snapshots, order numbers,
-- and audit timestamps are protected by the trigger below.

-- Remove both the legacy and current customer mutation policies. The migration
-- chain contains multiple generations of policy names, so clean up all known
-- names explicitly.
DROP POLICY IF EXISTS "Users can insert their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can delete their own orders" ON public.orders;
DROP POLICY IF EXISTS insert_own_orders ON public.orders;
DROP POLICY IF EXISTS update_own_orders ON public.orders;
DROP POLICY IF EXISTS delete_own_orders ON public.orders;

DROP POLICY IF EXISTS "Users can insert order items for their own orders" ON public.order_items;
DROP POLICY IF EXISTS "Users can update order items for their own orders" ON public.order_items;
DROP POLICY IF EXISTS "Users can delete order items for their own orders" ON public.order_items;
DROP POLICY IF EXISTS insert_own_order_items ON public.order_items;
DROP POLICY IF EXISTS update_own_order_items ON public.order_items;
DROP POLICY IF EXISTS delete_own_order_items ON public.order_items;

-- Remove the unrestricted vendor update policy before recreating it with the
-- same vendor predicate and a trigger-enforced column/status allowlist.
DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;
DROP POLICY IF EXISTS vendor_update_all_orders ON public.orders;
DROP POLICY IF EXISTS vendor_update_orders ON public.orders;

-- RLS is the authorization boundary; table privileges are the second boundary.
-- The SECURITY DEFINER order RPC writes with its function owner privileges.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.orders FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.order_items FROM authenticated;
GRANT SELECT ON TABLE public.orders, public.order_items TO authenticated;
GRANT UPDATE ON TABLE public.orders TO authenticated;

CREATE POLICY vendor_update_orders
ON public.orders
FOR UPDATE
TO authenticated
USING ((SELECT private.is_vendor()))
WITH CHECK ((SELECT private.is_vendor()));

CREATE OR REPLACE FUNCTION public.secure_order_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_vendor boolean := private.is_vendor();
BEGIN
  -- A trusted timestamp is assigned for every accepted update. This prevents a
  -- client from forging updated_at regardless of trigger execution order.
  NEW.updated_at := now();

  -- These fields are immutable after creation for both vendors and customers.
  -- `IS DISTINCT FROM` handles NULLs safely.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.order_number IS DISTINCT FROM OLD.order_number
     OR NEW.fulfillment_type IS DISTINCT FROM OLD.fulfillment_type
     OR NEW.delivery_address IS DISTINCT FROM OLD.delivery_address
     OR NEW.items_total IS DISTINCT FROM OLD.items_total
     OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
     OR NEW.grand_total IS DISTINCT FROM OLD.grand_total
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Order core fields cannot be modified';
  END IF;

  IF v_is_vendor THEN
    -- Vendors may update status and notes only. The immutable-field checks above
    -- prevent ownership, pricing, fulfillment, and address tampering.
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NOT (
        (OLD.status = 'received' AND NEW.status IN ('preparing', 'cancelled'))
        OR (OLD.status = 'preparing' AND NEW.status IN ('out_for_delivery', 'cancelled'))
        OR (OLD.status = 'out_for_delivery' AND NEW.status IN ('delivered', 'cancelled'))
      ) THEN
        RAISE EXCEPTION 'Invalid vendor status transition: % -> %', OLD.status, NEW.status;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- Customers have no UPDATE policy after this migration. This branch remains
  -- defensive in case a future policy is added accidentally.
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'received' AND NEW.status = 'cancelled') THEN
    RAISE EXCEPTION 'Customers can only cancel received orders';
  END IF;

  RETURN NEW;
END;
$$;

-- This function is invoked by a trigger, not by PostgREST. Keep it unavailable
-- as a direct API endpoint.
REVOKE ALL ON FUNCTION public.secure_order_updates() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_secure_order_updates ON public.orders;
CREATE TRIGGER trigger_secure_order_updates
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.secure_order_updates();

-- The separate timestamp trigger from the schema migration may remain in place;
-- secure_order_updates already assigns a trusted timestamp. Revoke direct
-- execution of the trigger helper as defense in depth.
REVOKE ALL ON FUNCTION public.trigger_set_updated_at() FROM PUBLIC, anon, authenticated;

-- Optional post-deployment verification queries. Run manually in a privileged
-- SQL session; they are comments so they do not affect migration execution.
--
-- SELECT policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('orders', 'order_items')
-- ORDER BY tablename, policyname;
--
-- SELECT has_table_privilege('authenticated', 'public.orders', 'INSERT') AS can_insert_orders,
--        has_table_privilege('authenticated', 'public.orders', 'UPDATE') AS can_update_orders,
--        has_table_privilege('authenticated', 'public.orders', 'DELETE') AS can_delete_orders,
--        has_table_privilege('authenticated', 'public.order_items', 'INSERT') AS can_insert_order_items,
--        has_table_privilege('authenticated', 'public.order_items', 'UPDATE') AS can_update_order_items,
--        has_table_privilege('authenticated', 'public.order_items', 'DELETE') AS can_delete_order_items;

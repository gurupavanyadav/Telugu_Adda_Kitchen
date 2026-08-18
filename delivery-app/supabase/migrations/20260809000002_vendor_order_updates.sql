-- 1. Create Trigger Function for Order Updates
CREATE OR REPLACE FUNCTION public.secure_order_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the user is a vendor, allow any update
  IF private.is_vendor() THEN
    RETURN NEW;
  END IF;

  -- Customers cannot modify core details or totals
  IF NEW.items_total != OLD.items_total OR 
     NEW.grand_total != OLD.grand_total OR 
     NEW.delivery_fee != OLD.delivery_fee OR
     NEW.order_number != OLD.order_number OR
     NEW.fulfillment_type != OLD.fulfillment_type OR
     NEW.user_id != OLD.user_id OR
     NEW.delivery_address::text != OLD.delivery_address::text THEN
    RAISE EXCEPTION 'Customers cannot modify order core details or totals';
  END IF;

  -- Customers can only update notes, OR change status to 'cancelled' (if currently 'received')
  IF NEW.status != OLD.status THEN
    IF OLD.status = 'received' AND NEW.status = 'cancelled' THEN
      -- Allowed
    ELSE
      RAISE EXCEPTION 'Customers can only cancel orders that are still in received status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Apply Trigger
DROP TRIGGER IF EXISTS trigger_secure_order_updates ON public.orders;
CREATE TRIGGER trigger_secure_order_updates
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE PROCEDURE public.secure_order_updates();

-- 2. Consolidate RLS Policies for Vendors

-- Drop Legacy Admin policies
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;

-- Add Vendor Policies
CREATE POLICY "vendor_view_all_orders"
ON public.orders FOR SELECT
TO authenticated
USING ((SELECT private.is_vendor()));

CREATE POLICY "vendor_update_all_orders"
ON public.orders FOR UPDATE
TO authenticated
USING ((SELECT private.is_vendor()))
WITH CHECK ((SELECT private.is_vendor()));

CREATE POLICY "vendor_view_all_order_items"
ON public.order_items FOR SELECT
TO authenticated
USING ((SELECT private.is_vendor()));

-- Ensure authenticated role has UPDATE privileges (required if missing)
GRANT UPDATE ON public.orders TO authenticated;

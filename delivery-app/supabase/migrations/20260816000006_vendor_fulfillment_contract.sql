-- P0-04: Single trusted restaurant operator fulfillment contract.
--
-- Vendors need operational order information to prepare and deliver food, but
-- do not need customer IDs, billing totals, item prices, or direct table access.
-- Replace broad vendor SELECT/UPDATE policies with narrowly shaped RPCs.

DROP POLICY IF EXISTS vendor_view_all_orders ON public.orders;
DROP POLICY IF EXISTS "vendor_view_all_orders" ON public.orders;
DROP POLICY IF EXISTS vendor_view_all_order_items ON public.order_items;
DROP POLICY IF EXISTS "vendor_view_all_order_items" ON public.order_items;
DROP POLICY IF EXISTS vendor_update_orders ON public.orders;
DROP POLICY IF EXISTS vendor_update_all_orders ON public.orders;

REVOKE UPDATE ON TABLE public.orders FROM authenticated;

CREATE OR REPLACE FUNCTION public.list_vendor_fulfillment_orders()
RETURNS TABLE (
  id uuid,
  order_number text,
  fulfillment_type text,
  delivery_address jsonb,
  status text,
  notes text,
  created_at timestamptz,
  fulfillment_items jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_vendor() THEN
    RAISE EXCEPTION 'Vendor role is required';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.order_number,
    o.fulfillment_type,
    o.delivery_address,
    o.status,
    o.notes,
    o.created_at,
    COALESCE(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'dish_name', oi.dish_name,
          'quantity', oi.quantity,
          'customizations', oi.customizations
        )
        ORDER BY oi.id
      ) FILTER (WHERE oi.id IS NOT NULL),
      '[]'::jsonb
    ) AS fulfillment_items
  FROM public.orders AS o
  LEFT JOIN public.order_items AS oi ON oi.order_id = o.id
  GROUP BY
    o.id,
    o.order_number,
    o.fulfillment_type,
    o.delivery_address,
    o.status,
    o.notes,
    o.created_at
  ORDER BY o.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_vendor_fulfillment_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_vendor_fulfillment_orders() TO authenticated;

CREATE OR REPLACE FUNCTION public.update_vendor_order_fulfillment(
  p_order_id uuid,
  p_status text,
  p_notes text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  status text,
  notes text,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_vendor() THEN
    RAISE EXCEPTION 'Vendor role is required';
  END IF;

  RETURN QUERY
  UPDATE public.orders AS o
  SET
    status = p_status,
    notes = COALESCE(p_notes, o.notes)
  WHERE o.id = p_order_id
  RETURNING o.id, o.status, o.notes, o.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.update_vendor_order_fulfillment(uuid, text, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_vendor_order_fulfillment(uuid, text, text)
TO authenticated;

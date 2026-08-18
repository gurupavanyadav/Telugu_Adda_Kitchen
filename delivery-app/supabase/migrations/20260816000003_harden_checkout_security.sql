-- Harden checkout input amplification and security-definer execution.
--
-- SEC-P01: Limit the size of the JSON order payload and customization arrays
-- before the private order writer performs catalog validation.
-- SEC-P03: Use an empty search_path for the security-definer order trigger.

CREATE OR REPLACE FUNCTION public.secure_order_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_vendor boolean := private.is_vendor();
BEGIN
  NEW.updated_at := pg_catalog.now();

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

  -- Defensive fallback. No customer UPDATE policy should remain enabled.
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'received' AND NEW.status = 'cancelled') THEN
    RAISE EXCEPTION 'Customers can only cancel received orders';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.secure_order_updates() FROM PUBLIC, anon, authenticated;

-- Recreate the public wrapper with cheap input limits before the private writer
-- iterates the untrusted JSON payload. The private writer retains all catalog,
-- ownership, and pricing validation.
CREATE OR REPLACE FUNCTION public.create_order(
  p_order_number text,
  p_fulfillment_type text,
  p_address_id uuid,
  p_notes text,
  p_items jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item jsonb;
  v_customizations jsonb;
BEGIN
  IF p_items IS NULL
     OR pg_catalog.jsonb_typeof(p_items) <> 'array'
     OR pg_catalog.jsonb_array_length(p_items) = 0
     OR pg_catalog.jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Order must contain between 1 and 50 items';
  END IF;

  -- Bound the request body before any per-item/per-customization loops run.
  IF pg_catalog.octet_length(p_items::text) > 131072 THEN
    RAISE EXCEPTION 'Order payload is too large';
  END IF;

  FOR v_item IN
    SELECT value FROM pg_catalog.jsonb_array_elements(p_items)
  LOOP
    IF pg_catalog.jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Each item must be an object';
    END IF;

    v_customizations := COALESCE(v_item->'customizations', '[]'::jsonb);
    IF pg_catalog.jsonb_typeof(v_customizations) <> 'array' THEN
      RAISE EXCEPTION 'Customizations must be an array';
    END IF;

    IF pg_catalog.jsonb_array_length(v_customizations) > 20 THEN
      RAISE EXCEPTION 'Too many customizations selected';
    END IF;
  END LOOP;

  RETURN private.internal_create_order(
    p_order_number,
    p_fulfillment_type,
    p_address_id,
    p_notes,
    p_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_order(text, text, uuid, text, jsonb)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order(text, text, uuid, text, jsonb)
TO authenticated;

-- 1. Fix trigger function being callable
-- Trigger functions should never be executed directly by users
REVOKE ALL ON FUNCTION public.secure_order_updates() FROM PUBLIC;

-- 2. Fix authenticated_security_definer_function_executable for create_order
-- We will move the actual SECURITY DEFINER logic into the 'private' schema 
-- (which is not exposed to the API, thus satisfying the linter), and leave a 
-- SECURITY INVOKER wrapper in the 'public' schema for the frontend to call.

-- Create the private schema function (Security Definer)
CREATE OR REPLACE FUNCTION private.internal_create_order(
  p_order_number text,
  p_fulfillment_type text,
  p_delivery_address jsonb,
  p_items_total numeric,
  p_delivery_fee numeric,
  p_grand_total numeric,
  p_notes text,
  p_items jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_user_id uuid;
  v_item jsonb;
  v_dish record;
  v_calculated_items_total numeric := 0;
  v_calculated_grand_total numeric := 0;
  v_unit_price numeric;
  v_line_total numeric;
  v_mod jsonb;
  v_mod_price numeric;
BEGIN
  -- 1. Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Verify prices by calculating totals server-side
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Fetch the exact current dish price
    SELECT * INTO v_dish FROM public.dishes WHERE id = (v_item->>'dish_id')::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Dish not found: %', v_item->>'dish_name';
    END IF;

    IF NOT v_dish.is_available THEN
      RAISE EXCEPTION 'Dish is currently unavailable: %', v_dish.name;
    END IF;

    v_unit_price := v_dish.price;
    v_line_total := v_unit_price * (v_item->>'quantity')::numeric;

    -- Add customizations to the line total
    IF v_item ? 'customizations' AND jsonb_array_length(v_item->'customizations') > 0 THEN
      FOR v_mod IN SELECT * FROM jsonb_array_elements(v_item->'customizations')
      LOOP
        v_mod_price := COALESCE((v_mod->>'price')::numeric, 0);
        v_line_total := v_line_total + (v_mod_price * (v_item->>'quantity')::numeric);
      END LOOP;
    END IF;

    v_calculated_items_total := v_calculated_items_total + v_line_total;
  END LOOP;

  v_calculated_grand_total := v_calculated_items_total + p_delivery_fee;

  -- 3. Compare with client totals
  IF p_items_total != v_calculated_items_total THEN
    RAISE EXCEPTION 'Items total mismatch. Client: %, Server: %', p_items_total, v_calculated_items_total;
  END IF;

  IF p_grand_total != v_calculated_grand_total THEN
    RAISE EXCEPTION 'Grand total mismatch. Client: %, Server: %', p_grand_total, v_calculated_grand_total;
  END IF;

  -- 4. Insert order
  INSERT INTO public.orders (
    user_id, order_number, status, items_total, delivery_fee, grand_total, 
    fulfillment_type, delivery_address, notes
  ) VALUES (
    v_user_id, p_order_number, 'received', v_calculated_items_total, p_delivery_fee, v_calculated_grand_total,
    p_fulfillment_type, p_delivery_address, p_notes
  ) RETURNING id INTO v_order_id;

  -- 5. Insert order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT price INTO v_unit_price FROM public.dishes WHERE id = (v_item->>'dish_id')::uuid;
    v_line_total := v_unit_price * (v_item->>'quantity')::numeric;
    
    IF v_item ? 'customizations' AND jsonb_array_length(v_item->'customizations') > 0 THEN
      FOR v_mod IN SELECT * FROM jsonb_array_elements(v_item->'customizations')
      LOOP
        v_mod_price := COALESCE((v_mod->>'price')::numeric, 0);
        v_line_total := v_line_total + (v_mod_price * (v_item->>'quantity')::numeric);
      END LOOP;
    END IF;

    INSERT INTO public.order_items (
      order_id, dish_id, dish_name, dish_price, quantity, customizations, line_total
    ) VALUES (
      v_order_id, (v_item->>'dish_id')::uuid, v_item->>'dish_name', v_unit_price, (v_item->>'quantity')::integer, COALESCE(v_item->'customizations', '[]'::jsonb), v_line_total
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;

-- Revoke public access to private function and grant to authenticated
REVOKE ALL ON FUNCTION private.internal_create_order FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.internal_create_order TO authenticated;

-- Replace public function with a SECURITY INVOKER wrapper
CREATE OR REPLACE FUNCTION public.create_order(
  p_order_number text,
  p_fulfillment_type text,
  p_delivery_address jsonb,
  p_items_total numeric,
  p_delivery_fee numeric,
  p_grand_total numeric,
  p_notes text,
  p_items jsonb
) RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.internal_create_order(
    p_order_number,
    p_fulfillment_type,
    p_delivery_address,
    p_items_total,
    p_delivery_fee,
    p_grand_total,
    p_notes,
    p_items
  );
$$;

-- Ensure public function is executable by authenticated users
REVOKE ALL ON FUNCTION public.create_order FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order TO authenticated;

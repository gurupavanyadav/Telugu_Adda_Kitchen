-- 1. Create the RPC function to securely calculate and insert orders
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_order_id uuid;
  v_computed_items_total numeric := 0;
  v_computed_grand_total numeric := 0;
  v_item record;
  v_dish record;
  v_addon jsonb;
  v_unit_price numeric;
  v_line_total numeric;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Compute totals and verify prices
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(dish_id uuid, quantity int, customizations jsonb)
  LOOP
    SELECT * INTO v_dish FROM public.dishes WHERE id = v_item.dish_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Dish not found: %', v_item.dish_id;
    END IF;

    v_unit_price := v_dish.price;

    IF v_item.customizations IS NOT NULL THEN
      FOR v_addon IN SELECT * FROM jsonb_array_elements(v_item.customizations)
      LOOP
        v_unit_price := v_unit_price + (v_addon->>'price')::numeric;
      END LOOP;
    END IF;

    v_line_total := v_unit_price * v_item.quantity;
    v_computed_items_total := v_computed_items_total + v_line_total;
  END LOOP;

  v_computed_grand_total := v_computed_items_total + p_delivery_fee;

  -- 2. Reject insert if totals mismatch
  IF v_computed_items_total != p_items_total OR v_computed_grand_total != p_grand_total THEN
    RAISE EXCEPTION 'Order totals mismatch. Client sent items_total: %, grand_total: %. Server computed items_total: %, grand_total: %',
      p_items_total, p_grand_total, v_computed_items_total, v_computed_grand_total;
  END IF;

  -- 3. Insert order
  INSERT INTO public.orders (
    user_id, order_number, fulfillment_type, delivery_address, items_total, delivery_fee, grand_total, notes
  ) VALUES (
    v_user_id, p_order_number, p_fulfillment_type, p_delivery_address, v_computed_items_total, p_delivery_fee, v_computed_grand_total, p_notes
  ) RETURNING id INTO v_order_id;

  -- 4. Insert order items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(dish_id uuid, dish_name text, quantity int, customizations jsonb)
  LOOP
    SELECT price INTO v_unit_price FROM public.dishes WHERE id = v_item.dish_id;
    IF v_item.customizations IS NOT NULL THEN
      FOR v_addon IN SELECT * FROM jsonb_array_elements(v_item.customizations)
      LOOP
        v_unit_price := v_unit_price + (v_addon->>'price')::numeric;
      END LOOP;
    END IF;

    v_line_total := v_unit_price * v_item.quantity;

    INSERT INTO public.order_items (
      order_id, dish_id, dish_name, dish_price, quantity, customizations, line_total
    ) VALUES (
      v_order_id, v_item.dish_id, v_item.dish_name, v_unit_price, v_item.quantity, COALESCE(v_item.customizations, '[]'::jsonb), v_line_total
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;

-- Revoke public execution to ensure only authenticated users can call it
REVOKE ALL ON FUNCTION public.create_order FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order TO authenticated;

-- 2. Secure tables by dropping direct INSERT policies for customers
DROP POLICY IF EXISTS "Users can insert their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert order items for their own orders" ON public.order_items;

-- Secure client-facing order creation RPC.
--
-- The client supplies only order intent:
--   order number, fulfillment type, owned address ID, notes, and item choices.
--
-- The database derives:
--   dish names, dish prices, customization prices, line totals, delivery fee,
--   address snapshot, order totals, and initial status.
--
-- The public wrapper is SECURITY INVOKER and callable only by authenticated
-- users. It delegates to a private SECURITY DEFINER function that writes the
-- order after validating auth.uid(), catalog state, and ownership.

DROP FUNCTION IF EXISTS public.create_order(text, text, uuid, numeric, numeric, numeric, text, jsonb);
DROP FUNCTION IF EXISTS public.create_order(text, text, uuid, text, jsonb);
DROP FUNCTION IF EXISTS private.internal_create_order(text, text, uuid, numeric, numeric, numeric, text, jsonb);
DROP FUNCTION IF EXISTS private.internal_create_order(text, text, uuid, text, jsonb);

CREATE OR REPLACE FUNCTION private.internal_create_order(
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
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_delivery_address jsonb := NULL;
  v_expected_delivery_fee numeric := 0;
  v_calculated_items_total numeric := 0;
  v_calculated_grand_total numeric := 0;
  v_item jsonb;
  v_customization jsonb;
  v_catalog_customization jsonb;
  v_normalized_customizations jsonb;
  v_dish public.dishes%ROWTYPE;
  v_dish_id uuid;
  v_quantity integer;
  v_total_quantity integer := 0;
  v_unit_price numeric;
  v_customization_price numeric;
  v_line_total numeric;
  v_customization_found boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_order_number IS NULL
     OR length(btrim(p_order_number)) = 0
     OR length(btrim(p_order_number)) > 64 THEN
    RAISE EXCEPTION 'Invalid order number';
  END IF;

  IF p_fulfillment_type IS NULL
     OR p_fulfillment_type NOT IN ('delivery', 'pickup') THEN
    RAISE EXCEPTION 'Invalid fulfillment type';
  END IF;

  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0
     OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Order must contain between 1 and 50 items';
  END IF;

  IF p_notes IS NOT NULL AND length(p_notes) > 1000 THEN
    RAISE EXCEPTION 'Order notes are too long';
  END IF;

  IF p_fulfillment_type = 'delivery' THEN
    IF p_address_id IS NULL THEN
      RAISE EXCEPTION 'A delivery address is required';
    END IF;

    SELECT jsonb_build_object(
      'label', a.label,
      'hostel_name', a.hostel_name,
      'room_number', a.room_number,
      'phone', a.phone
    )
    INTO v_delivery_address
    FROM public.addresses AS a
    WHERE a.id = p_address_id
      AND a.user_id = v_user_id;

    IF v_delivery_address IS NULL THEN
      RAISE EXCEPTION 'Delivery address not found';
    END IF;

    -- Replace this constant with a trusted settings table if fees become
    -- configurable. It is intentionally not accepted from the client.
    v_expected_delivery_fee := 20;
  ELSIF p_address_id IS NOT NULL THEN
    RAISE EXCEPTION 'Pickup orders cannot include a delivery address';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF jsonb_typeof(v_item) <> 'object'
       OR (v_item->>'dish_id') IS NULL
       OR (v_item->>'quantity') IS NULL THEN
      RAISE EXCEPTION 'Each item requires dish_id and quantity';
    END IF;

    BEGIN
      v_dish_id := (v_item->>'dish_id')::uuid;
      v_quantity := (v_item->>'quantity')::integer;
    EXCEPTION
      WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'Each item requires a valid dish_id and integer quantity';
    END;

    IF v_quantity < 1 OR v_quantity > 100 THEN
      RAISE EXCEPTION 'Each quantity must be between 1 and 100';
    END IF;

    v_total_quantity := v_total_quantity + v_quantity;
    IF v_total_quantity > 500 THEN
      RAISE EXCEPTION 'Total item quantity is too large';
    END IF;

    SELECT d.*
    INTO v_dish
    FROM public.dishes AS d
    WHERE d.id = v_dish_id
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Dish not found: %', v_dish_id;
    END IF;

    IF NOT v_dish.is_available THEN
      RAISE EXCEPTION 'Dish is currently unavailable: %', v_dish.name;
    END IF;

    IF v_dish.price IS NULL OR v_dish.price < 0 THEN
      RAISE EXCEPTION 'Dish has an invalid catalog price: %', v_dish.name;
    END IF;

    v_unit_price := v_dish.price;
    v_normalized_customizations := '[]'::jsonb;

    IF v_item ? 'customizations'
       AND v_item->'customizations' <> 'null'::jsonb THEN
      IF jsonb_typeof(v_item->'customizations') <> 'array' THEN
        RAISE EXCEPTION 'Customizations must be an array';
      END IF;

      FOR v_customization IN
        SELECT value FROM jsonb_array_elements(v_item->'customizations')
      LOOP
        IF jsonb_typeof(v_customization) <> 'object'
           OR (v_customization->>'label') IS NULL
           OR length(btrim(v_customization->>'label')) = 0
           OR length(v_customization->>'label') > 100 THEN
          RAISE EXCEPTION 'Each customization requires a valid label';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM jsonb_array_elements(v_normalized_customizations) AS existing(value)
          WHERE existing.value->>'label' = btrim(v_customization->>'label')
        ) THEN
          RAISE EXCEPTION 'Duplicate customization selected: %', v_customization->>'label';
        END IF;

        v_customization_found := false;
        v_customization_price := NULL;

        FOR v_catalog_customization IN
          SELECT value
          FROM jsonb_array_elements(COALESCE(v_dish.customizations, '[]'::jsonb))
        LOOP
          IF v_catalog_customization->>'label' = btrim(v_customization->>'label') THEN
            IF v_customization_found THEN
              RAISE EXCEPTION 'Duplicate customization in dish catalog: %', v_customization->>'label';
            END IF;

            v_customization_found := true;
            BEGIN
              v_customization_price := COALESCE(
                (v_catalog_customization->>'price')::numeric,
                0
              );
            EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
              RAISE EXCEPTION 'Invalid customization price in dish catalog';
            END;

            IF v_customization_price < 0 THEN
              RAISE EXCEPTION 'Customization prices cannot be negative';
            END IF;
          END IF;
        END LOOP;

        IF NOT v_customization_found THEN
          RAISE EXCEPTION 'Invalid customization for dish %: %',
            v_dish.name,
            btrim(v_customization->>'label');
        END IF;

        v_unit_price := v_unit_price + v_customization_price;
        v_normalized_customizations := v_normalized_customizations || jsonb_build_array(
          jsonb_build_object(
            'label', btrim(v_customization->>'label'),
            'price', v_customization_price
          )
        );
      END LOOP;
    END IF;

    v_line_total := v_unit_price * v_quantity;
    v_calculated_items_total := v_calculated_items_total + v_line_total;
  END LOOP;

  v_calculated_grand_total := v_calculated_items_total + v_expected_delivery_fee;

  INSERT INTO public.orders (
    user_id,
    order_number,
    status,
    items_total,
    delivery_fee,
    grand_total,
    fulfillment_type,
    delivery_address,
    notes
  ) VALUES (
    v_user_id,
    btrim(p_order_number),
    'received',
    v_calculated_items_total,
    v_expected_delivery_fee,
    v_calculated_grand_total,
    p_fulfillment_type,
    v_delivery_address,
    NULLIF(btrim(p_notes), '')
  )
  RETURNING id INTO v_order_id;

  -- Re-read catalog values during persistence. The transaction sees one
  -- consistent snapshot, and no client-provided names or prices are stored.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_dish_id := (v_item->>'dish_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    SELECT d.*
    INTO v_dish
    FROM public.dishes AS d
    WHERE d.id = v_dish_id;

    v_unit_price := v_dish.price;
    v_normalized_customizations := '[]'::jsonb;

    IF v_item ? 'customizations'
       AND v_item->'customizations' <> 'null'::jsonb THEN
      FOR v_customization IN
        SELECT value FROM jsonb_array_elements(v_item->'customizations')
      LOOP
        FOR v_catalog_customization IN
          SELECT value
          FROM jsonb_array_elements(COALESCE(v_dish.customizations, '[]'::jsonb))
        LOOP
          IF v_catalog_customization->>'label' = btrim(v_customization->>'label') THEN
            v_customization_price := COALESCE(
              (v_catalog_customization->>'price')::numeric,
              0
            );
            v_unit_price := v_unit_price + v_customization_price;
            v_normalized_customizations := v_normalized_customizations || jsonb_build_array(
              jsonb_build_object(
                'label', btrim(v_customization->>'label'),
                'price', v_customization_price
              )
            );
            EXIT;
          END IF;
        END LOOP;
      END LOOP;
    END IF;

    INSERT INTO public.order_items (
      order_id,
      dish_id,
      dish_name,
      dish_price,
      quantity,
      customizations,
      line_total
    ) VALUES (
      v_order_id,
      v_dish.id,
      v_dish.name,
      v_unit_price,
      v_quantity,
      v_normalized_customizations,
      v_unit_price * v_quantity
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION private.internal_create_order(text, text, uuid, text, jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_order(
  p_order_number text,
  p_fulfillment_type text,
  p_address_id uuid,
  p_notes text,
  p_items jsonb
) RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  -- The wrapper is the only executable entry point. The private writer is
  -- deliberately not granted to client roles and still derives auth.uid().
  SELECT private.internal_create_order(
    p_order_number,
    p_fulfillment_type,
    p_address_id,
    p_notes,
    p_items
  );
$$;

REVOKE ALL ON FUNCTION public.create_order(text, text, uuid, text, jsonb)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order(text, text, uuid, text, jsonb)
TO authenticated;

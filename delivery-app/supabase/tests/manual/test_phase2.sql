CREATE TEMP TABLE test_log (msg text);
GRANT ALL ON test_log TO public;

INSERT INTO public.dishes (id, name, cuisine, meal_type, price, customizations)
VALUES (
  '99999999-9999-9999-9999-999999999999',
  'RPC Test Dish',
  'Test',
  'Lunch',
  150,
  '[{"label":"Extra spice","price":25}]'::jsonb
)
ON CONFLICT (id) DO UPDATE
SET price = EXCLUDED.price,
    customizations = EXCLUDED.customizations,
    is_available = true;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

-- Test 1: Direct INSERT is denied.
DO $$
BEGIN
  INSERT INTO public.orders (user_id, order_number, fulfillment_type, items_total, delivery_fee, grand_total, status)
  VALUES ('11111111-1111-1111-1111-111111111111', 'ORD-DIRECT', 'pickup', 10, 0, 10, 'received');
  INSERT INTO test_log VALUES ('TEST 1: Direct INSERT allowed (FAIL)');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log VALUES ('TEST 1: Direct INSERT denied (PASS) - ' || SQLERRM);
END $$;

-- Test 2: The RPC accepts item intent only and derives the catalog price.
DO $$
DECLARE
  v_order_id uuid;
  v_items_total numeric;
BEGIN
  v_order_id := public.create_order(
    'ORD-VALID',
    'pickup',
    NULL,
    NULL,
    '[{"dish_id":"99999999-9999-9999-9999-999999999999","dish_name":"Forged name","quantity":1,"customizations":[]}]'::jsonb
  );

  SELECT items_total INTO v_items_total
  FROM public.orders
  WHERE id = v_order_id;

  IF v_items_total = 150 THEN
    INSERT INTO test_log VALUES ('TEST 2: Catalog price derived by server (PASS)');
  ELSE
    INSERT INTO test_log VALUES ('TEST 2: Catalog price was not derived by server (FAIL)');
  END IF;
END $$;

-- Test 3: A forged customization price is ignored and canonicalized.
DO $$
DECLARE
  v_order_id uuid;
  v_saved_price numeric;
  v_saved_customizations jsonb;
BEGIN
  v_order_id := public.create_order(
    'ORD-CUSTOMIZATION',
    'pickup',
    NULL,
    NULL,
    '[{"dish_id":"99999999-9999-9999-9999-999999999999","dish_name":"Forged name","quantity":1,"customizations":[{"label":"Extra spice","price":0}]}]'::jsonb
  );

  SELECT dish_price, customizations
  INTO v_saved_price, v_saved_customizations
  FROM public.order_items
  WHERE order_id = v_order_id;

  IF v_saved_price = 175
     AND v_saved_customizations = '[{"label":"Extra spice","price":25}]'::jsonb THEN
    INSERT INTO test_log VALUES ('TEST 3: Customization canonicalized (PASS)');
  ELSE
    INSERT INTO test_log VALUES ('TEST 3: Customization was not canonicalized (FAIL)');
  END IF;
END $$;

-- Test 4: Unknown customization labels are rejected.
DO $$
BEGIN
  PERFORM public.create_order(
    'ORD-UNKNOWN-CUSTOMIZATION',
    'pickup',
    NULL,
    NULL,
    '[{"dish_id":"99999999-9999-9999-9999-999999999999","quantity":1,"customizations":[{"label":"Not in catalog","price":0}]}]'::jsonb
  );
  INSERT INTO test_log VALUES ('TEST 4: Unknown customization accepted (FAIL)');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log VALUES ('TEST 4: Unknown customization rejected (PASS) - ' || SQLERRM);
END $$;

SELECT * FROM test_log;
ROLLBACK;

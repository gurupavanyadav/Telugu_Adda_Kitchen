-- Manual regression checks for the secure create_order RPC.
-- The fixed user UUID must exist in auth.users for the test project.

CREATE TEMP TABLE test_log (msg text);
GRANT ALL ON test_log TO public;

INSERT INTO public.dishes (
  id, name, cuisine, meal_type, price, is_available, customizations
)
VALUES (
  '88888888-8888-8888-8888-888888888888',
  'RPC Hardened Test Dish',
  'Test',
  'Lunch',
  150,
  true,
  '[{"label":"Extra spice","price":25}]'::jsonb
)
ON CONFLICT (id) DO UPDATE
SET price = EXCLUDED.price,
    is_available = EXCLUDED.is_available,
    customizations = EXCLUDED.customizations;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

-- Direct customer inserts remain blocked after the RPC hardening.
DO $$
BEGIN
  INSERT INTO public.orders (
    user_id, order_number, fulfillment_type, items_total, delivery_fee, grand_total, status
  ) VALUES (
    '11111111-1111-1111-1111-111111111111', 'ORD-DIRECT-NEW', 'pickup', 150, 0, 150, 'received'
  );
  INSERT INTO test_log VALUES ('Direct INSERT allowed (FAIL)');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log VALUES ('Direct INSERT denied (PASS) - ' || SQLERRM);
END $$;

-- A forged incoming customization price is ignored; catalog data is persisted.
DO $$
DECLARE
  v_order_id uuid;
  v_saved_price numeric;
  v_saved_customizations jsonb;
BEGIN
  v_order_id := public.create_order(
    'ORD-CANONICAL-CUSTOMIZATION',
    'pickup',
    NULL,
    NULL,
    '[{"dish_id":"88888888-8888-8888-8888-888888888888","dish_name":"Forged name","quantity":1,"customizations":[{"label":"Extra spice","price":0}]}]'::jsonb
  );

  SELECT dish_price, customizations
  INTO v_saved_price, v_saved_customizations
  FROM public.order_items
  WHERE order_id = v_order_id;

  IF v_saved_price = 175
     AND v_saved_customizations = '[{"label":"Extra spice","price":25}]'::jsonb THEN
    INSERT INTO test_log VALUES ('Customization normalized to catalog (PASS)');
  ELSE
    INSERT INTO test_log VALUES ('Customization normalized to catalog (FAIL)');
  END IF;
END $$;

-- Unknown customization labels are rejected.
DO $$
BEGIN
  PERFORM public.create_order(
    'ORD-UNKNOWN-CUSTOMIZATION',
    'pickup',
    NULL,
    NULL,
    '[{"dish_id":"88888888-8888-8888-8888-888888888888","quantity":1,"customizations":[{"label":"Not in catalog","price":0}]}]'::jsonb
  );
  INSERT INTO test_log VALUES ('Unknown customization accepted (FAIL)');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log VALUES ('Unknown customization rejected (PASS) - ' || SQLERRM);
END $$;

-- Unavailable dishes are rejected.
UPDATE public.dishes
SET is_available = false
WHERE id = '88888888-8888-8888-8888-888888888888';

DO $$
BEGIN
  PERFORM public.create_order(
    'ORD-UNAVAILABLE-DISH',
    'pickup',
    NULL,
    NULL,
    '[{"dish_id":"88888888-8888-8888-8888-888888888888","quantity":1}]'::jsonb
  );
  INSERT INTO test_log VALUES ('Unavailable dish accepted (FAIL)');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log VALUES ('Unavailable dish rejected (PASS) - ' || SQLERRM);
END $$;

SELECT * FROM test_log;
ROLLBACK;

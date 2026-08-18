CREATE TEMP TABLE test_log (msg text);
GRANT ALL ON test_log TO public;

INSERT INTO public.dishes (id, name, cuisine, meal_type, price)
VALUES ('99999999-9999-9999-9999-999999999999', 'RPC Test Dish', 'Test', 'Lunch', 150)
ON CONFLICT (id) DO NOTHING;

-- Customer creates an order through the trusted RPC.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

DO $$
DECLARE
  v_order_id uuid;
BEGIN
  v_order_id := public.create_order(
    'ORD-PHASE3',
    'pickup',
    NULL,
    NULL,
    '[{"dish_id":"99999999-9999-9999-9999-999999999999","dish_name":"Test","quantity":1}]'::jsonb
  );

  -- Direct customer updates are blocked by the RPC-only order boundary.
  BEGIN
    UPDATE public.orders SET grand_total = 0 WHERE id = v_order_id;
    INSERT INTO test_log VALUES ('TEST 1: Customer modified total (FAIL)');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log VALUES ('TEST 1: Customer modified total denied (PASS) - ' || SQLERRM);
  END;

  BEGIN
    UPDATE public.orders SET status = 'delivered' WHERE id = v_order_id;
    INSERT INTO test_log VALUES ('TEST 2: Customer changed status (FAIL)');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log VALUES ('TEST 2: Customer changed status denied (PASS) - ' || SQLERRM);
  END;
END $$;

-- Vendor updates are limited to valid operational transitions.
SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

DO $$
DECLARE
  v_order_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  v_order_id := public.create_order(
    'ORD-PHASE3-2',
    'pickup',
    NULL,
    NULL,
    '[{"dish_id":"99999999-9999-9999-9999-999999999999","dish_name":"Test","quantity":1}]'::jsonb
  );

  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

  BEGIN
    UPDATE public.orders SET status = 'preparing' WHERE id = v_order_id;
    INSERT INTO test_log VALUES ('TEST 3: Vendor advanced status (PASS)');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log VALUES ('TEST 3: Vendor advanced status denied (FAIL) - ' || SQLERRM);
  END;

  BEGIN
    UPDATE public.orders SET grand_total = 0 WHERE id = v_order_id;
    INSERT INTO test_log VALUES ('TEST 4: Vendor modified total (FAIL)');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log VALUES ('TEST 4: Vendor modified total denied (PASS) - ' || SQLERRM);
  END;
END $$;

SELECT * FROM test_log;
ROLLBACK;

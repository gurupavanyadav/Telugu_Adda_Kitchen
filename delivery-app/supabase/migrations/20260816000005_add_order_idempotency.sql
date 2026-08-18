-- P1-01: Server-enforced idempotency for checkout retries.
--
-- An idempotency key is scoped to the authenticated customer. The same key
-- with the same normalized intent returns the already-created order; reuse
-- with different intent is rejected. A transaction-scoped advisory lock makes
-- concurrent requests for the same (user, key) serialize before order writes.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS idempotency_key uuid,
  ADD COLUMN IF NOT EXISTS idempotency_fingerprint jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_user_idempotency_key_unique'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_user_idempotency_key_unique
      UNIQUE (user_id, idempotency_key);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_idempotency_pair_check'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_idempotency_pair_check
      CHECK ((idempotency_key IS NULL) = (idempotency_fingerprint IS NULL));
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.create_order(text, text, uuid, text, jsonb);

CREATE OR REPLACE FUNCTION public.create_order(
  p_order_number text,
  p_fulfillment_type text,
  p_address_id uuid,
  p_notes text,
  p_items jsonb,
  p_idempotency_key uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_existing_fingerprint jsonb;
  v_request_fingerprint jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'A valid idempotency key is required';
  END IF;

  -- JSONB normalizes object-key order, so semantically identical request
  -- objects compare structurally. Array ordering remains meaningful.
  v_request_fingerprint := jsonb_build_object(
    'order_number', NULLIF(btrim(p_order_number), ''),
    'fulfillment_type', p_fulfillment_type,
    'address_id', p_address_id,
    'notes', NULLIF(btrim(p_notes), ''),
    'items', p_items
  );

  -- The unique constraint provides durable integrity. This lock prevents a
  -- concurrent duplicate from reaching the writer before the first call has
  -- stored its key and fingerprint.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_user_id::text || ':' || p_idempotency_key::text)
  );

  SELECT o.id, o.idempotency_fingerprint
  INTO v_order_id, v_existing_fingerprint
  FROM public.orders AS o
  WHERE o.user_id = v_user_id
    AND o.idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_existing_fingerprint IS DISTINCT FROM v_request_fingerprint THEN
      RAISE EXCEPTION 'Idempotency key cannot be reused with a different order request';
    END IF;

    RETURN v_order_id;
  END IF;

  v_order_id := private.internal_create_order(
    p_order_number,
    p_fulfillment_type,
    p_address_id,
    p_notes,
    p_items
  );

  UPDATE public.orders
  SET idempotency_key = p_idempotency_key,
      idempotency_fingerprint = v_request_fingerprint
  WHERE id = v_order_id
    AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order persistence failed';
  END IF;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order(text, text, uuid, text, jsonb, uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order(text, text, uuid, text, jsonb, uuid)
TO authenticated;

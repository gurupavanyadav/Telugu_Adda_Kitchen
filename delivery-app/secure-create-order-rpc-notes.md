# Secure `create_order` RPC

## Client-facing signature

The client-facing function is:

```sql
public.create_order(
  p_order_number text,
  p_fulfillment_type text,
  p_address_id uuid,
  p_notes text,
  p_items jsonb,
  p_idempotency_key uuid
) RETURNS uuid
```

The client sends only order intent. It must not send `items_total`, `delivery_fee`, or `grand_total`.

```ts
const { data: orderId, error } = await supabase.rpc('create_order', {
  p_order_number: generateOrderNumber(),
  // Retain one random UUID for a checkout attempt and reuse it only for retries
  // of that exact request.
  p_idempotency_key: crypto.randomUUID(),
  p_fulfillment_type: fulfillmentType,
  p_address_id: fulfillmentType === 'delivery' ? selectedAddress?.id ?? null : null,
  p_notes: notes || null,
  p_items: items.map((item) => ({
    dish_id: item.dish.id,
    // Accepted for compatibility but ignored by the database.
    dish_name: item.dish.name,
    quantity: item.quantity,
    // Any incoming prices are ignored; labels are validated against the catalog.
    customizations: item.selectedCustomizations,
  })),
});
```

## Security properties

The public wrapper is `SECURITY DEFINER`, uses `SET search_path = ''`, is executable only by `authenticated`, and delegates to a private writer that is not executable by client roles. The implementation derives `auth.uid()` from the authenticated JWT and rejects anonymous calls.

The function validates the order number, fulfillment type, address ownership, item-array shape, item-count and quantity limits, dish existence, dish availability, non-negative catalog prices, customization labels, duplicate selections, and catalog membership. Delivery fees are derived server-side; pickup orders cannot include a delivery address.

The function persists trusted dish names, catalog prices, normalized customization prices, line totals, the address snapshot, and calculated order totals. It always creates the order with status `received`. A row-level share lock is taken on each dish during validation so a concurrent catalog update cannot invalidate the validated availability or price before the order is written.

The idempotency key is scoped to the authenticated customer. The same key and normalized request intent return the original order ID; the same key with different intent is rejected. A transaction-scoped advisory lock serializes simultaneous requests for the same customer/key pair so rapid duplicate submissions do not create multiple orders. Keep the key stable for a retry, then generate a new key only for a new checkout attempt.

## Migration order

Apply migrations in timestamp order through `20260816000005_add_order_idempotency.sql`. The final migration drops the five-argument public overload and creates the six-argument idempotency-aware contract. Because the function signature changes, the frontend and all SQL test callers must be deployed together with that migration.

## Validation status

The project’s TypeScript check, lint, production build, Node syntax check, and Git whitespace check pass. The repository’s existing four ESLint warnings remain. SQL execution was not available in the sandbox because Docker/Podman is not installed; run `supabase db reset --local`, `supabase db lint --local`, and `npm run test:rls` in a Docker-enabled environment before production deployment.

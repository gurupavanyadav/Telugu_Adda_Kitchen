import { supabase, type Order, type Customization } from '@/lib/supabase';

type RpcErrorLike = {
  code?: string;
  message?: string;
};

export type PlaceOrderInput = {
  orderNumber: string;
  idempotencyKey: string;
  fulfillmentType: 'delivery' | 'pickup';
  addressId: string | null;
  notes: string | null;
  items: Array<{
    dishId: string;
    dishName: string;
    quantity: number;
    customizations: Customization[];
  }>;
};

export type PlacedOrderSummary = Pick<
  Order,
  'id' | 'order_number' | 'items_total' | 'delivery_fee' | 'grand_total' | 'status'
>;

export type OrderClientError = {
  message: string;
  code?: string;
};

const GENERIC_ERROR = 'We could not place your order. Please review it and try again.';

/** Convert database/RPC failures into stable messages without exposing SQL details. */
export function sanitizeOrderError(error: RpcErrorLike | null | undefined): OrderClientError {
  const raw = (error?.message || '').toLowerCase();
  const code = error?.code;

  if (code === '42501' || raw.includes('not authenticated') || raw.includes('permission denied')) {
    return { code, message: 'Your session has expired. Please sign in again.' };
  }

  if (raw.includes('delivery address') || raw.includes('address not found')) {
    return { code, message: 'Please select a valid delivery address.' };
  }

  if (
    raw.includes('dish not found') ||
    raw.includes('unavailable') ||
    raw.includes('invalid customization') ||
    raw.includes('customization')
  ) {
    return { code, message: 'One or more items changed or are no longer available. Please review your cart.' };
  }

  if (
    raw.includes('payload') ||
    raw.includes('too many') ||
    raw.includes('too large') ||
    raw.includes('quantity') ||
    raw.includes('fulfillment') ||
    raw.includes('order number')
  ) {
    return { code, message: 'Please review your order details and try again.' };
  }

  if (raw.includes('idempotency key')) {
    return { code, message: 'This checkout was already used for a different order. Please refresh and try again.' };
  }

  if (code === '23505' || raw.includes('duplicate') || raw.includes('unique constraint')) {
    return { code, message: 'This order was already submitted. Please check your order history.' };
  }

  return { code, message: GENERIC_ERROR };
}

/**
 * Places an order using only client intent. The returned totals are read back
 * from the RLS-protected orders row and are authoritative for the UI.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<{
  data: PlacedOrderSummary | null;
  error: OrderClientError | null;
}> {
  const { data: orderId, error: rpcError } = await supabase.rpc('create_order', {
    p_order_number: input.orderNumber,
    p_idempotency_key: input.idempotencyKey,
    p_fulfillment_type: input.fulfillmentType,
    p_address_id: input.addressId,
    p_notes: input.notes,
    p_items: input.items.map((item) => ({
      dish_id: item.dishId,
      // The RPC ignores this compatibility field and reads the catalog name.
      dish_name: item.dishName,
      quantity: item.quantity,
      customizations: item.customizations,
    })),
  });

  if (rpcError || !orderId) {
    return { data: null, error: sanitizeOrderError(rpcError) };
  }

  const { data: order, error: readError } = await supabase
    .from('orders')
    .select('id,order_number,items_total,delivery_fee,grand_total,status')
    .eq('id', orderId)
    .single();

  if (readError || !order) {
    return { data: null, error: sanitizeOrderError(readError) };
  }

  return {
    data: {
      id: order.id,
      order_number: order.order_number,
      items_total: Number(order.items_total),
      delivery_fee: Number(order.delivery_fee),
      grand_total: Number(order.grand_total),
      status: order.status,
    },
    error: null,
  };
}

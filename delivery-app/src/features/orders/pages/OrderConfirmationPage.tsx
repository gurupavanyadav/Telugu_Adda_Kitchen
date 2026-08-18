import { useEffect, useState } from 'react';
import { supabase, type Order, type OrderItem, ORDER_STATUS_LABELS } from '@/lib/supabase';
import { formatPrice, formatDate } from '@/lib/utils';
import { navigate } from '@/lib/router';
import { CheckCircle2, Loader2, Package, Bike, Store, Receipt } from 'lucide-react';

export function OrderConfirmationPage({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrder() {
      const { data: orderData } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (orderData) {
        setOrder(orderData);
        const { data: itemsData } = await supabase.from('order_items').select('*').eq('order_id', orderId);
        if (itemsData) setItems(itemsData);
      }
      setLoading(false);
    }
    loadOrder();
  }, [orderId]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>;
  if (!order) return (
    <div className="container-app py-20 text-center">
      <p className="text-lg font-semibold text-charcoal-700">Order not found</p>
      <button onClick={() => navigate('/menu')} className="btn-primary mt-4">Back to Menu</button>
    </div>
  );

  return (
    <div className="animate-fade-in container-app py-8 max-w-2xl">
      <div className="text-center mb-8">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 mb-4 animate-scale-in">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>
        <h1 className="font-serif text-3xl font-bold text-charcoal-900">Order Placed Successfully!</h1>
        <p className="text-charcoal-500 mt-2">Your order number is <span className="font-bold text-primary-700">{order.order_number}</span></p>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-cream-200">
          <div className="flex items-center gap-2">
            {order.fulfillment_type === 'delivery' ? <Bike className="h-5 w-5 text-primary-700" /> : <Store className="h-5 w-5 text-primary-700" />}
            <span className="font-semibold text-charcoal-800">{order.fulfillment_type === 'delivery' ? 'Hostel Delivery' : 'Campus Pickup'}</span>
          </div>
          <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-800">{ORDER_STATUS_LABELS[order.status]}</span>
        </div>

        {order.delivery_address && (
          <div className="flex items-start gap-2 text-sm text-charcoal-600">
            <Package className="h-4 w-4 mt-0.5 text-charcoal-400 shrink-0" />
            <div>
              <p className="font-medium text-charcoal-700">{order.delivery_address.label}</p>
              <p>{order.delivery_address.hostel_name}, Room {order.delivery_address.room_number}</p>
              <p>{order.delivery_address.phone}</p>
            </div>
          </div>
        )}

        <div className="space-y-3 pt-2">
          <h3 className="font-serif text-base font-semibold text-charcoal-900 flex items-center gap-2"><Receipt className="h-4 w-4" />Items Ordered</h3>
          {items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <div>
                <p className="font-medium text-charcoal-800">{item.dish_name}</p>
                {item.customizations && item.customizations.length > 0 && <p className="text-xs text-charcoal-400">{item.customizations.map((c) => c.label).join(', ')}</p>}
                <p className="text-xs text-charcoal-400">Qty: {item.quantity}</p>
              </div>
              <span className="font-medium text-charcoal-700">{formatPrice(item.line_total)}</span>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-cream-200 space-y-2">
          <div className="flex justify-between text-sm text-charcoal-600"><span>Items Total</span><span>{formatPrice(order.items_total)}</span></div>
          <div className="flex justify-between text-sm text-charcoal-600"><span>Delivery Fee</span><span>{order.delivery_fee > 0 ? formatPrice(order.delivery_fee) : 'Free'}</span></div>
          <div className="flex justify-between font-bold text-base text-charcoal-900 pt-2 border-t border-cream-200"><span>Grand Total</span><span className="text-primary-700">{formatPrice(order.grand_total)}</span></div>
        </div>

        {order.notes && <div className="pt-2 text-sm text-charcoal-500"><span className="font-medium">Notes: </span>{order.notes}</div>}
        <p className="text-xs text-charcoal-400 text-center pt-2">Ordered on {formatDate(order.created_at)}</p>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={() => navigate(`/order-tracking/${order.id}`)} className="btn-primary flex-1">Track Order</button>
        <button onClick={() => navigate('/menu')} className="btn-outline flex-1">Order More</button>
      </div>
    </div>
  );
}
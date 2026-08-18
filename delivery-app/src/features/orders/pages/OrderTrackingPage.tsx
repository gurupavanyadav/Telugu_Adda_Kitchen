import { useEffect, useState } from 'react';
import { supabase, type Order, type OrderItem, ORDER_STATUS_LABELS, ORDER_STATUS_STEPS, type OrderStatus } from '@/lib/supabase';
import { formatPrice, formatDate } from '@/lib/utils';
import { navigate } from '@/lib/router';
import { Check, Loader2, Receipt, Bike, Store, Package } from 'lucide-react';

const STATUS_ICONS: Record<OrderStatus, typeof Check> = {
  received: Receipt, preparing: Loader2, out_for_delivery: Bike, delivered: Check, cancelled: Check,
};

export function OrderTrackingPage({ orderId }: { orderId: string }) {
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
    const interval = setInterval(loadOrder, 5000);
    return () => clearInterval(interval);
  }, [orderId]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>;
  if (!order) return (
    <div className="container-app py-20 text-center">
      <p className="text-lg font-semibold text-charcoal-700">Order not found</p>
      <button onClick={() => navigate('/orders')} className="btn-primary mt-4">My Orders</button>
    </div>
  );

  const currentStepIndex = ORDER_STATUS_STEPS.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="animate-fade-in container-app py-8 max-w-2xl">
      <h1 className="font-serif text-3xl font-bold text-charcoal-900 mb-2">Track Your Order</h1>
      <p className="text-charcoal-500 mb-8">Order <span className="font-semibold text-primary-700">{order.order_number}</span> — {formatDate(order.created_at)}</p>

      {!isCancelled ? (
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between">
            {ORDER_STATUS_STEPS.map((status, idx) => {
              const Icon = STATUS_ICONS[status];
              const isCompleted = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <div key={status} className="flex flex-col items-center flex-1 relative">
                  {idx > 0 && <div className={`absolute top-5 left-0 -translate-x-1/2 h-0.5 w-full ${idx <= currentStepIndex ? 'bg-primary-600' : 'bg-cream-200'}`} />}
                  <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full transition-all ${isCompleted ? 'bg-primary-700 text-white' : isCurrent ? 'bg-primary-600 text-white ring-4 ring-primary-200' : 'bg-cream-200 text-charcoal-400'}`}>
                    {isCompleted ? <Check className="h-5 w-5" /> : isCurrent && status === 'preparing' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <p className={`mt-2 text-xs font-medium text-center ${isCompleted || isCurrent ? 'text-charcoal-800' : 'text-charcoal-400'}`}>{ORDER_STATUS_LABELS[status]}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card p-6 mb-6 text-center bg-red-50 border-red-200"><p className="font-semibold text-red-700">This order was cancelled.</p></div>
      )}

      <div className="card p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          {order.fulfillment_type === 'delivery' ? <Bike className="h-5 w-5 text-primary-700" /> : <Store className="h-5 w-5 text-primary-700" />}
          <h3 className="font-serif text-base font-semibold text-charcoal-900">{order.fulfillment_type === 'delivery' ? 'Hostel Delivery' : 'Campus Pickup'}</h3>
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
      </div>

      <div className="card p-5 mb-6">
        <h3 className="font-serif text-base font-semibold text-charcoal-900 mb-3">Items</h3>
        <div className="space-y-2">
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
        <div className="pt-3 mt-3 border-t border-cream-200 flex justify-between font-bold text-charcoal-900"><span>Total</span><span className="text-primary-700">{formatPrice(order.grand_total)}</span></div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => navigate('/menu')} className="btn-primary flex-1">Order Again</button>
        <button onClick={() => navigate('/orders')} className="btn-outline flex-1">All Orders</button>
      </div>
    </div>
  );
}
import { useEffect, useState } from 'react';
import { supabase, type Order, type OrderItem, ORDER_STATUS_LABELS } from '@/lib/supabase';
import { useAuth } from '@/features/auth/context/auth';
import { formatPrice, formatDate } from '@/lib/utils';
import { navigate } from '@/lib/router';
import { Loader2, Receipt, Bike, Store, ChevronRight, ShoppingBag } from 'lucide-react';

type OrderWithItems = Order & { order_items: OrderItem[] };

export function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/signin'); return; }
    async function loadOrders() {
      const { data, error } = await supabase.from('orders').select('*, order_items(*)').eq('user_id', user!.id).order('created_at', { ascending: false });
      if (!error && data) setOrders(data as unknown as OrderWithItems[]);
      setLoading(false);
    }
    loadOrders();
  }, [user]);

  if (!user) return null;
  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>;

  return (
    <div className="animate-fade-in container-app py-8">
      <h1 className="font-serif text-3xl font-bold text-charcoal-900 mb-2">My Orders</h1>
      <p className="text-charcoal-500 mb-8">Track and review your past orders</p>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-cream-200 mb-4"><ShoppingBag className="h-10 w-10 text-charcoal-400" /></div>
          <p className="text-lg font-semibold text-charcoal-700">No orders yet</p>
          <p className="text-sm text-charcoal-500 mt-1">Your order history will appear here.</p>
          <button onClick={() => navigate('/menu')} className="btn-primary mt-4">Browse Menu</button>
        </div>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {orders.map((order) => (
            <button key={order.id} onClick={() => navigate(`/order-tracking/${order.id}`)}
              className="card p-5 w-full text-left hover:shadow-lg hover:border-primary-300 transition-all group">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary-700" /><span className="font-semibold text-charcoal-800">{order.order_number}</span></div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${order.status === 'delivered' ? 'bg-green-100 text-green-700' : order.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-primary-100 text-primary-800'}`}>{ORDER_STATUS_LABELS[order.status]}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-charcoal-500 mb-3">
                {order.fulfillment_type === 'delivery' ? <Bike className="h-4 w-4" /> : <Store className="h-4 w-4" />}
                <span>{order.fulfillment_type === 'delivery' ? 'Delivery' : 'Pickup'}</span><span>·</span><span>{formatDate(order.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0"><p className="text-sm text-charcoal-600 truncate">{order.order_items.map((item) => `${item.dish_name} ×${item.quantity}`).join(', ')}</p></div>
                <div className="flex items-center gap-3 ml-4">
                  <span className="font-bold text-primary-700">{formatPrice(order.grand_total)}</span>
                  <ChevronRight className="h-5 w-5 text-charcoal-400 group-hover:text-primary-600 transition-colors" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
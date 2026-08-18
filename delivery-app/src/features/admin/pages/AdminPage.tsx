import { useEffect, useState } from 'react';
import {
  supabase,
  type VendorFulfillmentOrder,
  type Dish,
  type OrderStatus,
  ORDER_STATUS_LABELS,
} from '@/lib/supabase';
import { useAuth } from '@/features/auth/context/auth';
import { navigate } from '@/lib/router';
import { Loader2, Plus } from 'lucide-react';
import { VegMark } from '@/features/menu/components/VegMark';

const formatPrice = (value: number | string) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(Number(value));

export function AdminPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'orders' | 'menu'>('orders');

  // Orders State
  const [orders, setOrders] = useState<VendorFulfillmentOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Menu State
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user || role !== 'vendor') {
      navigate('/');
    }
  }, [user, role, authLoading]);

  useEffect(() => {
    if (role !== 'vendor') return;

    if (activeTab === 'orders') {
      loadOrders();
    } else {
      loadDishes();
    }
  }, [activeTab, role]);

  const loadOrders = async () => {
    setLoadingOrders(true);
    setOrderError(null);
    const { data, error } = await supabase.rpc('list_vendor_fulfillment_orders');

    if (error) {
      setOrderError('Orders could not be loaded. Refresh the page or sign in again.');
    } else if (data) {
      setOrders((data as VendorFulfillmentOrder[]).sort(
        (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
      ));
    }
    setLoadingOrders(false);
  };

  const loadDishes = async () => {
    setLoadingMenu(true);
    const { data } = await supabase.from('dishes').select('*').order('name');

    if (data) setDishes(data as Dish[]);
    setLoadingMenu(false);
  };

  const updateOrderStatus = async (order: VendorFulfillmentOrder, status: OrderStatus) => {
    const { error } = await supabase.rpc('update_vendor_order_fulfillment', {
      p_order_id: order.id,
      p_status: status,
      p_notes: order.notes,
    });

    if (!error) {
      setOrders((currentOrders) =>
        currentOrders.map((currentOrder) =>
          currentOrder.id === order.id ? { ...currentOrder, status } : currentOrder,
        ),
      );
    } else {
      setOrderError('That status change was not accepted. Refresh to see the current order state.');
    }
  };

  const toggleDishAvailability = async (dishId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('dishes')
      .update({ is_available: !currentStatus })
      .eq('id', dishId);

    if (!error) {
      setDishes(
        dishes.map((d) =>
          d.id === dishId ? { ...d, is_available: !currentStatus } : d
        )
      );
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!user || role !== 'vendor') {
    return null;
  }

  return (
    <div className="min-h-screen bg-cream-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-charcoal-900">Vendor Dashboard</h1>
          <p className="mt-2 text-sm text-charcoal-500">
            Manage orders and menu availability.
          </p>
        </div>

        <div className="mb-6 flex gap-4 border-b border-cream-200">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-2 pb-3 text-sm font-semibold transition-all ${
              activeTab === 'orders'
                ? 'border-b-2 border-primary-600 text-primary-700'
                : 'text-charcoal-500 hover:text-charcoal-800'
            }`}
          >
            Manage Orders
          </button>
          <button
            onClick={() => setActiveTab('menu')}
            className={`px-2 pb-3 text-sm font-semibold transition-all ${
              activeTab === 'menu'
                ? 'border-b-2 border-primary-600 text-primary-700'
                : 'text-charcoal-500 hover:text-charcoal-800'
            }`}
          >
            Manage Menu
          </button>
        </div>

        {activeTab === 'orders' && (
          <div>
            {loadingOrders ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
              </div>
            ) : orderError ? (
              <p className="py-10 text-center text-red-700">{orderError}</p>
            ) : orders.length === 0 ? (
              <p className="py-10 text-center text-charcoal-500">No orders found.</p>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="card border-l-4 border-l-primary-600 p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-charcoal-900">
                          Order #{order.order_number}
                        </h3>
                        <p className="mt-1 text-sm text-charcoal-500">
                          {order.fulfillment_type}
                        </p>

                        <ul className="mt-2 space-y-1 text-sm text-charcoal-700">
                          {order.fulfillment_items.map((item, index) => (
                            <li key={`${order.id}-${item.dish_name}-${index}`}>
                              {item.quantity}× {item.dish_name}
                              {item.customizations.length > 0 && (
                                <span className="text-charcoal-500">
                                  {' '}
                                  — {item.customizations.map((customization) => customization.label).join(', ')}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>

                        {order.fulfillment_type === 'delivery' &&
                          order.delivery_address && (
                            <p className="mt-1 text-xs text-charcoal-400">
                              Delivery to: {order.delivery_address.hostel_name}, Room{' '}
                              {order.delivery_address.room_number} (
                              {order.delivery_address.phone})
                            </p>
                          )}
                      </div>

                      <div className="flex items-center gap-3">
                        <select
                          value={order.status}
                          onChange={(e) =>
                            updateOrderStatus(order, e.target.value as OrderStatus)
                          }
                          className="input text-sm font-medium"
                        >
                          {Object.entries(ORDER_STATUS_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'menu' && (
          <div>
            <div className="mb-4 flex justify-end">
              <button className="btn-primary flex items-center gap-2 text-sm">
                <Plus className="h-4 w-4" /> Add Dish (Coming Soon)
              </button>
            </div>

            {loadingMenu ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
              </div>
            ) : dishes.length === 0 ? (
              <p className="py-10 text-center text-charcoal-500">
                No dishes found in the database.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {dishes.map((dish) => (
                  <div
                    key={dish.id}
                    className={`card flex gap-4 p-4 ${
                      dish.is_available ? '' : 'opacity-60 grayscale'
                    }`}
                  >
                    {dish.image_url && (
                      <img
                        src={dish.image_url}
                        alt={dish.name}
                        className="h-20 w-20 rounded-lg object-cover"
                      />
                    )}

                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold text-charcoal-900">{dish.name}</h3>
                        <VegMark isVeg={dish.is_veg} />
                      </div>

                      <p className="mt-1 text-sm font-bold text-primary-700">
                        {formatPrice(dish.price)}
                      </p>

                      <div className="mt-3 flex items-center justify-between">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            dish.is_available
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {dish.is_available ? 'Available' : 'Unavailable'}
                        </span>

                        <button
                          onClick={() => toggleDishAvailability(dish.id, dish.is_available)}
                          className="text-xs font-semibold text-primary-600 hover:underline"
                        >
                          Toggle
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { supabase, type Address as AddressType, DELIVERY_FEE } from '@/lib/supabase';
import { useAuth } from '@/features/auth/context/auth';
import { useCart } from '@/features/cart/context/cart';
import { placeOrder } from '@/features/checkout/api/orderClient';
import { formatPrice, generateOrderNumber } from '@/lib/utils';
import { navigate } from '@/lib/router';
import { Bike, Store, MapPin, Loader2, ShoppingBag, Check, AlertCircle, Plus } from 'lucide-react';

export function CheckoutPage() {
  const { user } = useAuth();
  const { items, itemsTotal, clearCart } = useCart();
  const [addresses, setAddresses] = useState<AddressType[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup'>('delivery');
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutAttempt] = useState(() => ({
    // One key is retained for the mounted checkout attempt so a retry after a
    // network timeout replays the same server-side order instead of duplicating it.
    idempotencyKey: crypto.randomUUID(),
    orderNumber: generateOrderNumber(),
  }));

  useEffect(() => {
    if (!user) { navigate('/signin'); return; }
    if (items.length === 0) { navigate('/menu'); return; }
    async function loadAddresses() {
      const { data, error } = await supabase.from('addresses').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
      if (!error && data) { setAddresses(data); if (data.length > 0) setSelectedAddressId(data[0].id); }
      setLoadingAddresses(false);
    }
    loadAddresses();
  }, [user, items.length]);

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
  const deliveryFee = fulfillmentType === 'delivery' ? DELIVERY_FEE : 0;
  const total = itemsTotal + deliveryFee;

  const handlePlaceOrder = async () => {
    if (!user) return;
    setError(null);
    if (fulfillmentType === 'delivery' && !selectedAddress) { setError('Please select a delivery address or add a new one.'); return; }
    setPlacing(true);

    const payload = {
      p_order_number: checkoutAttempt.orderNumber,
      p_fulfillment_type: fulfillmentType,
      p_address_id: fulfillmentType === 'delivery' ? selectedAddress?.id ?? null : null,
      p_notes: notes || null,
      p_items: items.map(item => ({
        dish_id: item.dish.id,
        dish_name: item.dish.name,
        quantity: item.quantity,
        customizations: item.selectedCustomizations
      }))
    };

    const { data: placedOrder, error: orderError } = await placeOrder({
      orderNumber: payload.p_order_number,
      idempotencyKey: checkoutAttempt.idempotencyKey,
      fulfillmentType: payload.p_fulfillment_type,
      addressId: payload.p_address_id,
      notes: payload.p_notes,
      items: payload.p_items.map((item) => ({
        dishId: item.dish_id,
        dishName: item.dish_name,
        quantity: item.quantity,
        customizations: item.customizations,
      })),
    });

    if (orderError || !placedOrder) {
      setError(orderError?.message || 'We could not place your order. Please try again.');
      setPlacing(false);
      return;
    }

    // `placedOrder.grand_total` is read back from the protected orders row;
    // the confirmation page also reloads the same authoritative server data.
    clearCart();
    navigate(`/order-confirmation/${placedOrder.id}`);
  };

  if (!user || items.length === 0) return null;

  return (
    <div className="animate-fade-in container-app py-8">
      <h1 className="font-serif text-3xl font-bold text-charcoal-900 mb-8">Checkout</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="font-serif text-lg font-semibold text-charcoal-900 mb-3">How would you like to get your order?</h2>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setFulfillmentType('delivery')}
                className={`flex items-center gap-3 rounded-xl border-2 p-4 transition-all ${fulfillmentType === 'delivery' ? 'border-primary-600 bg-primary-50' : 'border-charcoal-200 hover:border-primary-300'}`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${fulfillmentType === 'delivery' ? 'bg-primary-700 text-white' : 'bg-cream-200 text-charcoal-500'}`}><Bike className="h-5 w-5" /></div>
                <div className="text-left"><p className="font-semibold text-sm text-charcoal-800">Hostel Delivery</p><p className="text-xs text-charcoal-500">+{formatPrice(DELIVERY_FEE)} fee</p></div>
              </button>
              <button onClick={() => setFulfillmentType('pickup')}
                className={`flex items-center gap-3 rounded-xl border-2 p-4 transition-all ${fulfillmentType === 'pickup' ? 'border-primary-600 bg-primary-50' : 'border-charcoal-200 hover:border-primary-300'}`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${fulfillmentType === 'pickup' ? 'bg-primary-700 text-white' : 'bg-cream-200 text-charcoal-500'}`}><Store className="h-5 w-5" /></div>
                <div className="text-left"><p className="font-semibold text-sm text-charcoal-800">Campus Pickup</p><p className="text-xs text-charcoal-500">No delivery fee</p></div>
              </button>
            </div>
          </div>

          {fulfillmentType === 'delivery' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-serif text-lg font-semibold text-charcoal-900">Delivery Address</h2>
                <button onClick={() => navigate('/addresses')} className="flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline"><Plus className="h-4 w-4" />Add New</button>
              </div>
              {loadingAddresses ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary-600" /></div>
              ) : addresses.length === 0 ? (
                <div className="card p-6 text-center">
                  <MapPin className="h-10 w-10 text-charcoal-300 mx-auto mb-3" />
                  <p className="text-charcoal-600 text-sm mb-4">No saved addresses yet. Add one to get your order delivered.</p>
                  <button onClick={() => navigate('/addresses')} className="btn-primary">Add Address</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map((addr) => (
                    <button key={addr.id} onClick={() => setSelectedAddressId(addr.id)}
                      className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${selectedAddressId === addr.id ? 'border-primary-600 bg-primary-50' : 'border-charcoal-200 hover:border-primary-300'}`}>
                      <div className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 ${selectedAddressId === addr.id ? 'border-primary-600 bg-primary-600' : 'border-charcoal-300'}`}>
                        {selectedAddressId === addr.id && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-charcoal-800">{addr.label}</p>
                        <p className="text-sm text-charcoal-500 mt-0.5">{addr.hostel_name}, Room {addr.room_number}</p>
                        <p className="text-xs text-charcoal-400 mt-0.5">{addr.phone}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {fulfillmentType === 'pickup' && (
            <div className="card p-5">
              <div className="flex items-start gap-3">
                <Store className="h-5 w-5 text-primary-700 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm text-charcoal-800">Pickup from our campus counter</p>
                  <p className="text-sm text-charcoal-500 mt-1">Inside College Campus, Hostel Block Area. Your order will be ready for pickup — we'll update the status so you know when to come.</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="label">Order Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special instructions for the kitchen..." rows={3} className="input resize-none" />
          </div>

          <div>
            <h2 className="font-serif text-lg font-semibold text-charcoal-900 mb-3">Payment Method</h2>
            <div className="card p-5 flex items-center gap-3 border-2 border-primary-200 bg-primary-50">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-700 text-white"><ShoppingBag className="h-5 w-5" /></div>
              <div><p className="font-semibold text-sm text-charcoal-800">Pay on Delivery / Pickup</p><p className="text-xs text-charcoal-500">Pay with cash when you receive your order</p></div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="card p-5 sticky top-20">
            <h2 className="font-serif text-lg font-semibold text-charcoal-900 mb-4">Order Summary</h2>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {items.map((item, idx) => {
                const addonTotal = item.selectedCustomizations.reduce((s, c) => s + c.price, 0);
                const unitPrice = item.dish.price + addonTotal;
                return (
                  <div key={idx} className="flex justify-between text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-charcoal-800 truncate">{item.dish.name}</p>
                      {item.selectedCustomizations.length > 0 && <p className="text-xs text-charcoal-400">{item.selectedCustomizations.map((c) => c.label).join(', ')}</p>}
                      <p className="text-xs text-charcoal-400">Qty: {item.quantity}</p>
                    </div>
                    <span className="font-medium text-charcoal-700 ml-2">{formatPrice(unitPrice * item.quantity)}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-cream-200 space-y-2">
              <div className="flex justify-between text-sm text-charcoal-600"><span>Items Total</span><span>{formatPrice(itemsTotal)}</span></div>
              <div className="flex justify-between text-sm text-charcoal-600"><span>Delivery Fee</span><span>{fulfillmentType === 'delivery' ? formatPrice(DELIVERY_FEE) : 'Free'}</span></div>
              <div className="flex justify-between font-bold text-base text-charcoal-900 pt-2 border-t border-cream-200"><span>Grand Total</span><span className="text-primary-700">{formatPrice(total)}</span></div>
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 mt-4"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>
            )}
            <button onClick={handlePlaceOrder} disabled={placing} className="btn-primary w-full mt-4">
              {placing ? <Loader2 className="h-5 w-5 animate-spin" /> : `Place Order — ${formatPrice(total)}`}
            </button>
            <p className="text-xs text-charcoal-400 text-center mt-2">Pay on delivery — no card needed</p>
          </div>
        </div>
      </div>
    </div>
  );
}

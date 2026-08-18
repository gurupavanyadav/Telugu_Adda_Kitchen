import { X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';
import { useCart, customizationsKey } from '@/features/cart/context/cart';
import { formatPrice } from '@/lib/utils';
import { navigate } from '@/lib/router';
import { VegMark } from '@/features/menu/components/VegMark';

export function CartDrawer() {
  const { items, isOpen, closeCart, updateQuantity, removeItem, totalItems, itemsTotal, deliveryFee, grandTotal } =
    useCart();

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={closeCart} />
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-cream-50 shadow-2xl animate-slide-in-right flex flex-col">
        <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4 bg-primary-700 text-white">
          <h2 className="font-serif text-lg font-bold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Your Cart ({totalItems})
          </h2>
          <button onClick={closeCart} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-primary-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-cream-200">
              <ShoppingBag className="h-10 w-10 text-charcoal-400" />
            </div>
            <p className="text-lg font-semibold text-charcoal-700">Your cart is empty</p>
            <p className="text-sm text-charcoal-500">Add some delicious home-cooked meals!</p>
            <button onClick={() => { closeCart(); navigate('/menu'); }} className="btn-primary mt-2">Browse Menu</button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {items.map((item) => {
                const key = customizationsKey(item.selectedCustomizations);
                const addonTotal = item.selectedCustomizations.reduce((s, c) => s + c.price, 0);
                const unitPrice = item.dish.price + addonTotal;
                return (
                  <div key={`${item.dish.id}-${key}`} className="card p-4">
                    <div className="flex gap-3">
                      {item.dish.image_url && (
                        <img src={item.dish.image_url} alt={item.dish.name} className="h-16 w-16 rounded-lg object-cover shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <VegMark isVeg={item.dish.is_veg} />
                          <h3 className="font-semibold text-sm text-charcoal-800 leading-tight">{item.dish.name}</h3>
                        </div>
                        {item.selectedCustomizations.length > 0 && (
                          <p className="text-xs text-charcoal-500 mt-1">
                            {item.selectedCustomizations.map((c) => c.label).join(', ')}
                          </p>
                        )}
                        <p className="text-sm font-semibold text-primary-700 mt-1">{formatPrice(unitPrice)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQuantity(item.dish.id, key, item.quantity - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-charcoal-200 text-charcoal-700 hover:bg-cream-200 transition-colors">
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="font-semibold text-sm w-8 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.dish.id, key, item.quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-charcoal-200 text-charcoal-700 hover:bg-cream-200 transition-colors">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm text-charcoal-800">{formatPrice(unitPrice * item.quantity)}</span>
                        <button onClick={() => removeItem(item.dish.id, key)} className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-cream-200 px-5 py-4 bg-white space-y-3">
              <div className="flex justify-between text-sm text-charcoal-600">
                <span>Items Total</span><span className="font-medium">{formatPrice(itemsTotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-charcoal-600">
                <span>Delivery Fee</span><span className="font-medium">{formatPrice(deliveryFee)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-charcoal-900 pt-2 border-t border-cream-200">
                <span>Grand Total</span><span className="text-primary-700">{formatPrice(grandTotal)}</span>
              </div>
              <button onClick={() => { closeCart(); navigate('/checkout'); }} className="btn-primary w-full">Proceed to Checkout</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
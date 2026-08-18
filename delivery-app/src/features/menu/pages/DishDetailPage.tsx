import { useEffect, useState } from 'react';
import { supabase, type Dish, type Customization } from '@/lib/supabase';
import { formatPrice } from '@/lib/utils';
import { navigate } from '@/lib/router';
import { VegMark } from '@/features/menu/components/VegMark';
import { useCart } from '@/features/cart/context/cart';
import { ArrowLeft, Plus, Minus, Loader2, UtensilsCrossed, Check } from 'lucide-react';

export function DishDetailPage({ dishId }: { dishId: string }) {
  const [dish, setDish] = useState<Dish | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedCustomizations, setSelectedCustomizations] = useState<Customization[]>([]);
  const [adding, setAdding] = useState(false);
  const { addItem } = useCart();

  useEffect(() => {
    async function loadDish() {
      setLoading(true);
      const { data, error } = await supabase.from('dishes').select('*').eq('id', dishId).maybeSingle();
      if (error || !data) { setLoading(false); return; }
      setDish(data);
      setLoading(false);
    }
    loadDish();
  }, [dishId]);

  const toggleCustomization = (c: Customization) => {
    setSelectedCustomizations((prev) => {
      const exists = prev.find((x) => x.label === c.label);
      if (exists) return prev.filter((x) => x.label !== c.label);
      return [...prev, c];
    });
  };

  const addonTotal = selectedCustomizations.reduce((s, c) => s + c.price, 0);
  const unitPrice = (dish?.price ?? 0) + addonTotal;
  const totalPrice = unitPrice * quantity;

  const handleAddToCart = () => {
    if (!dish) return;
    setAdding(true);
    addItem(dish, quantity, selectedCustomizations);
    setTimeout(() => { setAdding(false); navigate('/menu'); }, 500);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>;
  }

  if (!dish) {
    return (
      <div className="container-app py-20 text-center">
        <UtensilsCrossed className="h-12 w-12 text-charcoal-300 mx-auto mb-4" />
        <p className="text-lg font-semibold text-charcoal-700">Dish not found</p>
        <button onClick={() => navigate('/menu')} className="btn-primary mt-4">Back to Menu</button>
      </div>
    );
  }

  const customizations: Customization[] = Array.isArray(dish.customizations) ? dish.customizations : [];

  return (
    <div className="animate-fade-in">
      <div className="container-app py-6">
        <button onClick={() => navigate('/menu')} className="flex items-center gap-2 text-sm text-charcoal-500 hover:text-primary-700 transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Menu
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="relative rounded-2xl overflow-hidden shadow-lg h-80 md:h-[28rem]">
            {dish.image_url ? (
              <img src={dish.image_url} alt={dish.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-cream-200"><UtensilsCrossed className="h-16 w-16 text-charcoal-400" /></div>
            )}
            <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-sm font-medium text-charcoal-700 shadow-sm">
              <VegMark isVeg={dish.is_veg} />{dish.is_veg ? 'Veg' : 'Non-Veg'}
            </div>
            <div className="absolute top-4 right-4 rounded-full bg-primary-700/90 px-3 py-1.5 text-sm font-bold text-white shadow-sm">{dish.cuisine}</div>
          </div>

          <div className="flex flex-col">
            <h1 className="font-serif text-3xl font-bold text-charcoal-900">{dish.name}</h1>
            <p className="text-charcoal-600 mt-3 leading-relaxed">{dish.description}</p>
            <div className="flex items-center gap-4 mt-4">
              <span className="font-bold text-2xl text-primary-700">{formatPrice(dish.price)}</span>
              <span className="text-sm text-charcoal-500">Base price</span>
            </div>

            {customizations.length > 0 && (
              <div className="mt-6">
                <h3 className="font-serif text-lg font-semibold text-charcoal-900 mb-3">Customize your order</h3>
                <div className="flex flex-wrap gap-2">
                  {customizations.map((c) => {
                    const isSelected = selectedCustomizations.some((x) => x.label === c.label);
                    return (
                      <button key={c.label} onClick={() => toggleCustomization(c)}
                        className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all ${isSelected ? 'border-primary-600 bg-primary-50 text-primary-800' : 'border-charcoal-200 text-charcoal-600 hover:border-primary-300'}`}>
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                        {c.label}
                        {c.price > 0 && <span className="text-xs text-charcoal-400">+{formatPrice(c.price)}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-auto pt-8">
              <div className="flex items-center gap-4 mb-4">
                <span className="text-sm font-medium text-charcoal-700">Quantity</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-charcoal-200 text-charcoal-700 hover:bg-cream-200 transition-colors"><Minus className="h-4 w-4" /></button>
                  <span className="font-bold text-lg w-10 text-center">{quantity}</span>
                  <button onClick={() => setQuantity((q) => q + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-charcoal-200 text-charcoal-700 hover:bg-cream-200 transition-colors"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-cream-100 px-5 py-3 mb-4">
                <span className="text-sm font-medium text-charcoal-600">Total</span>
                <span className="font-bold text-xl text-primary-700">{formatPrice(totalPrice)}</span>
              </div>
              <button onClick={handleAddToCart} disabled={adding} className="btn-primary w-full text-base py-3">
                {adding ? 'Added to cart!' : (<><Plus className="h-5 w-5" />Add to Cart — {formatPrice(totalPrice)}</>)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
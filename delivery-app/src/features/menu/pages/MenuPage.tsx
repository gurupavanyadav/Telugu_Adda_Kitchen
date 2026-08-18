import { useEffect, useState, useMemo } from 'react';
import { supabase, type Dish, type MealType, MEAL_TYPES } from '@/lib/supabase';
import { getCurrentMealType, formatPrice } from '@/lib/utils';
import { navigate } from '@/lib/router';
import { VegMark } from '@/features/menu/components/VegMark';
import { useCart } from '@/features/cart/context/cart';
import { Plus, Loader2, Sunrise, Sun, Moon, UtensilsCrossed, Search } from 'lucide-react';

const MEAL_ICONS: Record<MealType, typeof Sunrise> = {
  Breakfast: Sunrise,
  Lunch: Sun,
  Dinner: Moon,
};

export function MenuPage() {
  const [activeMeal, setActiveMeal] = useState<MealType>(getCurrentMealType());
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'veg' | 'nonveg'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState<string>('all');
  const { addItem } = useCart();

  useEffect(() => {
    async function loadMenu() {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_menus')
        .select(`dish_id, dishes!inner(id, name, description, price, image_url, cuisine, meal_type, is_veg, is_available, customizations, created_at)`)
        .eq('menu_date', today)
        .eq('meal_type', activeMeal);

      if (error) { setLoading(false); return; }
      const dishList = (data ?? []).map((row) => row.dishes as unknown as Dish).filter(Boolean);
      setDishes(dishList);
      setLoading(false);
    }
    loadMenu();
  }, [activeMeal]);

  const uniqueCuisines = useMemo(() => {
    const cuisines = new Set(dishes.map(d => d.cuisine));
    return ['all', ...Array.from(cuisines)];
  }, [dishes]);

  const filteredDishes = useMemo(() => {
    return dishes.filter((dish) => {
      // 1. Veg/Nonveg Filter
      if (filter === 'veg' && !dish.is_veg) return false;
      if (filter === 'nonveg' && dish.is_veg) return false;
      
      // 2. Search Query Filter
      if (searchQuery && !dish.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      
      // 3. Cuisine Filter
      if (selectedCuisine !== 'all' && dish.cuisine !== selectedCuisine) return false;

      return true;
    });
  }, [dishes, filter, searchQuery, selectedCuisine]);

  return (
    <div className="animate-fade-in">
      <div className="bg-gradient-to-br from-primary-800 to-primary-900 text-cream-50">
        <div className="container-app py-10">
          <div className="inline-flex items-center gap-2 text-sm text-gold-300 mb-2">
            <UtensilsCrossed className="h-4 w-4" />
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold">Today's Menu</h1>
          <p className="text-cream-200 text-sm mt-1">Fresh dishes change daily. Pick your meal below.</p>
        </div>
      </div>

      <div className="sticky top-16 z-30 bg-cream-50/95 backdrop-blur-md border-b border-cream-200">
        <div className="container-app py-3 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
              {MEAL_TYPES.map((meal) => {
                const Icon = MEAL_ICONS[meal];
                const isActive = activeMeal === meal;
                return (
                  <button key={meal} onClick={() => setActiveMeal(meal)}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all shrink-0 ${isActive ? 'bg-primary-700 text-white shadow-md' : 'text-charcoal-600 hover:bg-cream-200'}`}>
                    <Icon className="h-4 w-4" />{meal}
                  </button>
                );
              })}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal-400" />
              <input
                type="text"
                placeholder="Search dishes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-9 h-10 w-full sm:w-64"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex gap-1">
              {(['all', 'veg', 'nonveg'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${filter === f ? 'bg-charcoal-800 text-cream-50' : 'text-charcoal-500 hover:bg-cream-200'}`}>
                  {f === 'veg' && <VegMark isVeg={true} />}
                  {f === 'nonveg' && <VegMark isVeg={false} />}
                  {f === 'all' ? 'All Items' : f === 'veg' ? 'Veg Only' : 'Non-Veg Only'}
                </button>
              ))}
            </div>
            
            {uniqueCuisines.length > 2 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <span className="text-xs text-charcoal-400 font-medium whitespace-nowrap">Cuisine:</span>
                {uniqueCuisines.map((cuisine) => (
                  <button key={cuisine} onClick={() => setSelectedCuisine(cuisine)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${selectedCuisine === cuisine ? 'bg-primary-100 text-primary-800 border border-primary-300' : 'bg-white text-charcoal-600 border border-cream-200 hover:bg-cream-100'}`}>
                    {cuisine === 'all' ? 'Any Cuisine' : cuisine}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container-app py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
        ) : filteredDishes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <UtensilsCrossed className="h-12 w-12 text-charcoal-300 mb-4" />
            <p className="text-lg font-semibold text-charcoal-700">No dishes available</p>
            <p className="text-sm text-charcoal-500">
              {searchQuery ? `No matches for "${searchQuery}".` : `No items matched your filters for ${activeMeal} today.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDishes.map((dish) => (
              <div key={dish.id} className="card overflow-hidden hover:shadow-xl hover:-translate-y-1 cursor-pointer group" onClick={() => navigate(`/dish/${dish.id}`)}>
                <div className="relative h-44 overflow-hidden">
                  {dish.image_url ? (
                    <img src={dish.image_url} alt={dish.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-cream-200"><UtensilsCrossed className="h-10 w-10 text-charcoal-400" /></div>
                  )}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-charcoal-700 shadow-sm">
                    <VegMark isVeg={dish.is_veg} />{dish.is_veg ? 'Veg' : 'Non-Veg'}
                  </div>
                  <div className="absolute top-3 right-3 rounded-full bg-primary-700/90 px-2.5 py-1 text-xs font-bold text-white shadow-sm">{dish.cuisine}</div>
                </div>
                <div className="p-4">
                  <h3 className="font-serif text-lg font-semibold text-charcoal-900 leading-tight">{dish.name}</h3>
                  <p className="text-sm text-charcoal-500 mt-1 line-clamp-2">{dish.description}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="font-bold text-lg text-primary-700">{formatPrice(dish.price)}</span>
                    <button onClick={(e) => { e.stopPropagation(); addItem(dish, 1, []); }} className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-700 text-white hover:bg-primary-800 active:scale-90 transition-all">
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Customization, Dish } from '@/lib/supabase';
import { DELIVERY_FEE } from '@/lib/supabase';

export type CartItem = {
  dish: Dish;
  quantity: number;
  selectedCustomizations: Customization[];
};

type CartContextValue = {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (dish: Dish, quantity: number, customizations: Customization[]) => void;
  updateQuantity: (dishId: string, customizationsKey: string, quantity: number) => void;
  removeItem: (dishId: string, customizationsKey: string) => void;
  clearCart: () => void;
  totalItems: number;
  itemsTotal: number;
  deliveryFee: number;
  grandTotal: number;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

function cKey(c: Customization[]) {
  return c.map((x) => x.label).sort().join(',');
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);

  const addItem = (dish: Dish, quantity: number, customizations: Customization[]) => {
    const key = cKey(customizations);
    setItems((prev) => {
      const existing = prev.find(
        (item) => item.dish.id === dish.id && cKey(item.selectedCustomizations) === key,
      );
      if (existing) {
        return prev.map((item) =>
          item === existing ? { ...item, quantity: item.quantity + quantity } : item,
        );
      }
      return [...prev, { dish, quantity, selectedCustomizations: customizations }];
    });
    setIsOpen(true);
  };

  const updateQuantity = (dishId: string, key: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(dishId, key);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.dish.id === dishId && cKey(item.selectedCustomizations) === key
          ? { ...item, quantity }
          : item,
      ),
    );
  };

  const removeItem = (dishId: string, key: string) => {
    setItems((prev) =>
      prev.filter(
        (item) => !(item.dish.id === dishId && cKey(item.selectedCustomizations) === key),
      ),
    );
  };

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const itemsTotal = items.reduce((sum, item) => {
    const addonTotal = item.selectedCustomizations.reduce((s, c) => s + c.price, 0);
    return sum + (item.dish.price + addonTotal) * item.quantity;
  }, 0);
  const deliveryFee = items.length > 0 ? DELIVERY_FEE : 0;
  const grandTotal = itemsTotal + deliveryFee;

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        openCart,
        closeCart,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        totalItems,
        itemsTotal,
        deliveryFee,
        grandTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export { cKey as customizationsKey };
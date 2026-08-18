import { UtensilsCrossed, ShoppingCart, User, Menu as MenuIcon, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/features/auth/context/auth';
import { useCart } from '@/features/cart/context/cart';
import { navigate } from '@/lib/router';

export function Header() {
  const { user, role, signOut } = useAuth();
  const { totalItems, openCart } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);

  const go = (path: string) => {
    setMobileOpen(false);
    navigate(path);
  };

  return (
    <header className="sticky top-0 z-40 bg-cream-50/95 backdrop-blur-md border-b border-cream-200 shadow-sm">
      <div className="container-app">
        <div className="flex h-16 items-center justify-between">
          <button onClick={() => go('/')} className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-700 text-gold-300 shadow-md group-hover:scale-105 transition-transform">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div className="text-left">
              <h1 className="font-serif text-lg font-bold leading-none text-primary-800">Telugu Adda</h1>
              <p className="text-xs text-charcoal-500 leading-tight">Restaurant</p>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            <button onClick={() => go('/')} className="btn-ghost">Home</button>
            <button onClick={() => go('/menu')} className="btn-ghost">Today's Menu</button>
            {user && <button onClick={() => go('/orders')} className="btn-ghost">My Orders</button>}
            {role === 'vendor' && (
              <button onClick={() => go('/admin')} className="btn-ghost text-primary-700 font-semibold">Vendor Dashboard</button>
            )}
            {user ? (
              <>
                <button onClick={() => go('/profile')} className="btn-ghost">
                  <User className="h-4 w-4" /> Profile
                </button>
                <button onClick={signOut} className="btn-outline">Sign Out</button>
              </>
            ) : (
              <>
                <button onClick={() => go('/signin')} className="btn-ghost">Sign In</button>
                <button onClick={() => go('/signup')} className="btn-primary">Sign Up</button>
              </>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={openCart}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-primary-700 text-white hover:bg-primary-800 transition-colors"
              aria-label="Cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-400 px-1 text-xs font-bold text-charcoal-900">
                  {totalItems}
                </span>
              )}
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden flex h-10 w-10 items-center justify-center rounded-lg text-charcoal-700 hover:bg-cream-200"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="md:hidden flex flex-col gap-1 pb-4 animate-fade-in">
            <button onClick={() => go('/')} className="btn-ghost justify-start">Home</button>
            <button onClick={() => go('/menu')} className="btn-ghost justify-start">Today's Menu</button>
            {user && <button onClick={() => go('/orders')} className="btn-ghost justify-start">My Orders</button>}
            {role === 'vendor' && (
              <button onClick={() => go('/admin')} className="btn-ghost justify-start text-primary-700 font-semibold">Vendor Dashboard</button>
            )}
            {user ? (
              <>
                <button onClick={() => go('/profile')} className="btn-ghost justify-start">Profile</button>
                <button onClick={signOut} className="btn-outline justify-start">Sign Out</button>
              </>
            ) : (
              <>
                <button onClick={() => go('/signin')} className="btn-ghost justify-start">Sign In</button>
                <button onClick={() => go('/signup')} className="btn-primary justify-start">Sign Up</button>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
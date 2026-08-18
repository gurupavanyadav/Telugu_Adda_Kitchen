import { useEffect, useState, useCallback } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'menu' }
  | { name: 'dish'; dishId: string }
  | { name: 'signin' }
  | { name: 'signup' }
  | { name: 'profile' }
  | { name: 'addresses' }
  | { name: 'checkout' }
  | { name: 'order-confirmation'; orderId: string }
  | { name: 'order-tracking'; orderId: string }
  | { name: 'orders' }
  | { name: 'admin' };

function parseHash(): Route {
  const hash = window.location.hash.replace(/^#/, '');
  const parts = hash.split('/').filter(Boolean);

  if (parts.length === 0) return { name: 'home' };
  if (parts[0] === 'menu') return { name: 'menu' };
  if (parts[0] === 'dish' && parts[1]) return { name: 'dish', dishId: parts[1] };
  if (parts[0] === 'signin') return { name: 'signin' };
  if (parts[0] === 'signup') return { name: 'signup' };
  if (parts[0] === 'profile') return { name: 'profile' };
  if (parts[0] === 'addresses') return { name: 'addresses' };
  if (parts[0] === 'checkout') return { name: 'checkout' };
  if (parts[0] === 'order-confirmation' && parts[1]) return { name: 'order-confirmation', orderId: parts[1] };
  if (parts[0] === 'order-tracking' && parts[1]) return { name: 'order-tracking', orderId: parts[1] };
  if (parts[0] === 'orders') return { name: 'orders' };
  if (parts[0] === 'admin') return { name: 'admin' };

  return { name: 'home' };
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(parseHash());

  useEffect(() => {
    const handler = () => setRoute(parseHash());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigate = useCallback((path: string) => {
    window.location.hash = path;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return { route, navigate };
}

export function navigate(path: string) {
  window.location.hash = path;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
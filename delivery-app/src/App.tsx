import { AuthProvider } from '@/features/auth/context/auth';
import { CartProvider } from '@/features/cart/context/cart';
import { useRouter } from '@/lib/router';
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';
import { CartDrawer } from '@/features/cart/components/CartDrawer';
import { HomePage } from '@/pages/HomePage';
import { MenuPage } from '@/features/menu/pages/MenuPage';
import { DishDetailPage } from '@/features/menu/pages/DishDetailPage';
import { SignInPage } from '@/features/auth/pages/SignInPage';
import { SignUpPage } from '@/features/auth/pages/SignUpPage';
import { ProfilePage } from '@/features/profile/pages/ProfilePage';
import { CheckoutPage } from '@/features/checkout/pages/CheckoutPage';
import { OrderConfirmationPage } from '@/features/orders/pages/OrderConfirmationPage';
import { OrderTrackingPage } from '@/features/orders/pages/OrderTrackingPage';
import { OrdersPage } from '@/features/orders/pages/OrdersPage';
import { AdminPage } from '@/features/admin/pages/AdminPage';

function RouteView() {
  const { route } = useRouter();

  switch (route.name) {
    case 'home': return <HomePage />;
    case 'menu': return <MenuPage />;
    case 'dish': return <DishDetailPage dishId={route.dishId} />;
    case 'signin': return <SignInPage />;
    case 'signup': return <SignUpPage />;
    case 'profile': return <ProfilePage />;
    case 'addresses': return <ProfilePage />;
    case 'checkout': return <CheckoutPage />;
    case 'order-confirmation': return <OrderConfirmationPage orderId={route.orderId} />;
    case 'order-tracking': return <OrderTrackingPage orderId={route.orderId} />;
    case 'orders': return <OrdersPage />;
    case 'admin': return <AdminPage />;
    default: return <HomePage />;
  }
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">
            <RouteView />
          </main>
          <Footer />
          <CartDrawer />
        </div>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
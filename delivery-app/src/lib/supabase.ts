import { createClient } from '@supabase/supabase-js';

function configurationError(message: string): never {
  const localHint = import.meta.env.DEV
    ? ' Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in a local .env.local file.'
    : ' Configure the deployment environment with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';

  throw new Error(`[Supabase configuration] ${message}.${localHint}`);
}

function getRequiredPublicEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const value = import.meta.env[name]?.trim();

  if (!value) {
    return configurationError(`Missing required ${name}`);
  }

  if (/(^|_)(your|replace|change_me)(_|$)|^</i.test(value)) {
    return configurationError(`${name} contains a placeholder value`);
  }

  return value;
}

const supabaseUrl = getRequiredPublicEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getRequiredPublicEnv('VITE_SUPABASE_ANON_KEY');

try {
  const parsedUrl = new URL(supabaseUrl);
  const isExplicitLocalDevelopmentUrl =
    import.meta.env.DEV &&
    parsedUrl.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '::1'].includes(parsedUrl.hostname);

  if ((!isExplicitLocalDevelopmentUrl && parsedUrl.protocol !== 'https:') || !parsedUrl.hostname) {
    configurationError('VITE_SUPABASE_URL must be an absolute HTTPS URL');
  }
} catch {
  configurationError('VITE_SUPABASE_URL must be a valid absolute HTTPS URL');
}

if (!/^(eyJ|sb_publishable_)/.test(supabaseAnonKey)) {
  configurationError('VITE_SUPABASE_ANON_KEY must be a Supabase anon or publishable key');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type Customization = {
  label: string;
  price: number;
};

export type AddressSnapshot = {
  label: string;
  hostel_name: string;
  room_number: string;
  phone: string;
};

export type OrderStatus = 'received' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';

export type Dish = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  cuisine: string;
  meal_type: string;
  is_veg: boolean;
  is_available: boolean;
  customizations: Customization[];
  created_at: string;
};

export type Address = {
  id: string;
  user_id: string;
  label: string;
  hostel_name: string;
  room_number: string;
  phone: string;
  created_at: string;
};

export type Order = {
  id: string;
  user_id: string;
  order_number: string;
  fulfillment_type: 'delivery' | 'pickup';
  delivery_address: AddressSnapshot | null;
  items_total: number;
  delivery_fee: number;
  grand_total: number;
  status: OrderStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  dish_id: string | null;
  dish_name: string;
  dish_price: number;
  quantity: number;
  customizations: Customization[];
  line_total: number;
};

export type VendorFulfillmentItem = Pick<OrderItem, 'dish_name' | 'quantity' | 'customizations'>;

export type VendorFulfillmentOrder = Pick<
  Order,
  'id' | 'order_number' | 'fulfillment_type' | 'delivery_address' | 'status' | 'notes' | 'created_at'
> & {
  fulfillment_items: VendorFulfillmentItem[];
};

export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  received: 'Order Received',
  preparing: 'Being Prepared',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const ORDER_STATUS_STEPS: OrderStatus[] = ['received', 'preparing', 'out_for_delivery', 'delivered'];

export const DELIVERY_FEE = 20;

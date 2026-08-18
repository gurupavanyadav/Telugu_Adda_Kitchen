/*
# Telugu Adda Restaurant — Core Schema

1. Overview
   Creates the full data model for a campus hostel food-ordering app:
   - A catalog of dishes (cuisine, meal type, veg/non-veg, price, customizations).
   - A daily-menu system that decides which dishes are available on a given day & meal period.
   - Customer saved delivery addresses (hostel + room + phone).
   - Orders with a delivery-or-pickup choice, pay-on-delivery, and a live status.
   - Order items capturing each dish and its chosen customizations.

2. New Tables
   - `dishes`         — master catalog of every dish the restaurant can offer.
     - id, name, description, price, image_url, cuisine, meal_type, is_veg, is_available, customizations (jsonb), created_at
   - `daily_menus`    — which dishes are available on which day & meal period.
     - id, menu_date, meal_type, dish_id, created_at
   - `addresses`      — saved delivery addresses for signed-in customers.
     - id, user_id, label, hostel_name, room_number, phone, created_at
   - `orders`         — customer orders with fulfillment type and live status.
     - id, user_id, order_number, fulfillment_type, delivery_address (jsonb), items_total, delivery_fee, grand_total, status, notes, created_at, updated_at
   - `order_items`    — line items for each order.
     - id, order_id, dish_id, dish_name, dish_price, quantity, customizations (jsonb), line_total

3. Security (RLS)
   - `dishes` and `daily_menus`: readable by everyone (anon + authenticated) so browsing the menu works without sign-in. Writes restricted to authenticated owners (service-role manages seed data; no direct anon writes).
   - `addresses`: owner-scoped CRUD — each authenticated user only sees/edits their own addresses.
   - `orders`: owner-scoped — authenticated users can create orders for themselves and read/update their own orders.
   - `order_items`: scoped through the parent order's ownership.

4. Important Notes
   - `user_id` columns default to `auth.uid()` so client inserts that omit user_id still satisfy RLS.
   - All tables have RLS enabled.
   - Policies are dropped before recreate for idempotency.
*/

-- ============================================================
-- dishes: master catalog
-- ============================================================
CREATE TABLE IF NOT EXISTS dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  cuisine text NOT NULL DEFAULT 'Telugu',
  meal_type text NOT NULL DEFAULT 'Lunch',
  is_veg boolean NOT NULL DEFAULT true,
  is_available boolean NOT NULL DEFAULT true,
  customizations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_dishes" ON dishes;
CREATE POLICY "anon_read_dishes" ON dishes FOR SELECT
  TO anon, authenticated USING (true);

-- Only authenticated users can modify dish catalog (admin/seed use service role)
DROP POLICY IF EXISTS "auth_manage_dishes" ON dishes;
CREATE POLICY "auth_manage_dishes" ON dishes FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- ============================================================
-- daily_menus: which dishes are available on a given day & meal
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_date date NOT NULL,
  meal_type text NOT NULL,
  dish_id uuid NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (menu_date, meal_type, dish_id)
);

ALTER TABLE daily_menus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_daily_menus" ON daily_menus;
CREATE POLICY "anon_read_daily_menus" ON daily_menus FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_manage_daily_menus" ON daily_menus;
CREATE POLICY "auth_manage_daily_menus" ON daily_menus FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- Index for the common "today's menu" query
CREATE INDEX IF NOT EXISTS idx_daily_menus_date_meal ON daily_menus (menu_date, meal_type);

-- ============================================================
-- addresses: saved delivery addresses per customer
-- ============================================================
CREATE TABLE IF NOT EXISTS addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Home',
  hostel_name text NOT NULL,
  room_number text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_addresses" ON addresses;
CREATE POLICY "select_own_addresses" ON addresses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_addresses" ON addresses;
CREATE POLICY "insert_own_addresses" ON addresses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_addresses" ON addresses;
CREATE POLICY "update_own_addresses" ON addresses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_addresses" ON addresses;
CREATE POLICY "delete_own_addresses" ON addresses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- orders: customer orders
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  fulfillment_type text NOT NULL DEFAULT 'delivery',
  delivery_address jsonb,
  items_total numeric(10,2) NOT NULL DEFAULT 0,
  delivery_fee numeric(10,2) NOT NULL DEFAULT 0,
  grand_total numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'received',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_orders" ON orders;
CREATE POLICY "select_own_orders" ON orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_orders" ON orders;
CREATE POLICY "insert_own_orders" ON orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_orders" ON orders;
CREATE POLICY "update_own_orders" ON orders FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_orders" ON orders;
CREATE POLICY "delete_own_orders" ON orders FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders (user_id, created_at DESC);

-- ============================================================
-- order_items: line items per order
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  dish_id uuid REFERENCES dishes(id) ON DELETE SET NULL,
  dish_name text NOT NULL,
  dish_price numeric(10,2) NOT NULL DEFAULT 0,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  customizations jsonb NOT NULL DEFAULT '[]'::jsonb,
  line_total numeric(10,2) NOT NULL DEFAULT 0
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_order_items" ON order_items;
CREATE POLICY "select_own_order_items" ON order_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_order_items" ON order_items;
CREATE POLICY "insert_own_order_items" ON order_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_order_items" ON order_items;
CREATE POLICY "update_own_order_items" ON order_items FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_order_items" ON order_items;
CREATE POLICY "delete_own_order_items" ON order_items FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  );

-- ============================================================
-- updated_at trigger for orders
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON orders;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

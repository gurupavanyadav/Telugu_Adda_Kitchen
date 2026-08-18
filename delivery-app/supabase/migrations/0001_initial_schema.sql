-- Enable UUID extension (not needed, using gen_random_uuid())
-- create extension if not exists "uuid-ossp";

-- PROFILES
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for profiles
alter table public.profiles enable row level security;
create policy "Users can view their own profile" on profiles for select using (auth.uid() = id);
create policy "Admins can view all profiles" on profiles for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'customer');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- DISHES
create table public.dishes (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  price numeric not null,
  image_url text,
  cuisine text not null,
  meal_type text not null,
  is_veg boolean not null default true,
  is_available boolean not null default true,
  customizations jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.dishes enable row level security;
create policy "Dishes are viewable by everyone" on dishes for select using (true);
create policy "Only admins can insert dishes" on dishes for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Only admins can update dishes" on dishes for update using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Only admins can delete dishes" on dishes for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- DAILY MENUS
create table public.daily_menus (
  id uuid default gen_random_uuid() primary key,
  menu_date date not null,
  meal_type text not null,
  dish_id uuid references public.dishes on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (menu_date, meal_type, dish_id)
);

alter table public.daily_menus enable row level security;
create policy "Daily menus are viewable by everyone" on daily_menus for select using (true);
create policy "Only admins can insert daily menus" on daily_menus for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Only admins can delete daily menus" on daily_menus for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- ADDRESSES
create table public.addresses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  label text not null,
  hostel_name text not null,
  room_number text not null,
  phone text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.addresses enable row level security;
create policy "Users can view their own addresses" on addresses for select using (auth.uid() = user_id);
create policy "Users can insert their own addresses" on addresses for insert with check (auth.uid() = user_id);
create policy "Users can update their own addresses" on addresses for update using (auth.uid() = user_id);
create policy "Users can delete their own addresses" on addresses for delete using (auth.uid() = user_id);
create policy "Admins can view all addresses" on addresses for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- ORDERS
create table public.orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  order_number text not null unique,
  fulfillment_type text not null check (fulfillment_type in ('delivery', 'pickup')),
  delivery_address jsonb,
  items_total numeric not null,
  delivery_fee numeric not null,
  grand_total numeric not null,
  status text not null default 'received' check (status in ('received', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.orders enable row level security;
create policy "Users can view their own orders" on orders for select using (auth.uid() = user_id);
create policy "Users can insert their own orders" on orders for insert with check (auth.uid() = user_id);
create policy "Admins can view all orders" on orders for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins can update all orders" on orders for update using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- ORDER ITEMS
create table public.order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders on delete cascade not null,
  dish_id uuid references public.dishes on delete set null,
  dish_name text not null,
  dish_price numeric not null,
  quantity integer not null check (quantity > 0),
  customizations jsonb not null default '[]'::jsonb,
  line_total numeric not null
);

alter table public.order_items enable row level security;
create policy "Users can view their own order items" on order_items for select using (
  exists (select 1 from orders where orders.id = order_items.order_id and orders.user_id = auth.uid())
);
create policy "Users can insert order items for their own orders" on order_items for insert with check (
  exists (select 1 from orders where orders.id = order_items.order_id and orders.user_id = auth.uid())
);
create policy "Admins can view all order items" on order_items for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

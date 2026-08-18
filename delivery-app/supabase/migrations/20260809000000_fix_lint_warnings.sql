-- Fix: mutable search_path and public execute permissions for handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (new.id, 'customer');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke execute from public to prevent arbitrary calls (fixes "callable by authenticated users / without authentication")
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- Fix: mutable search_path for trigger_set_updated_at
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- P0 remediation: vendor catalog authorization is enforced by the existing
-- vendor_manage_dishes RLS policy. Restore the separate table privileges
-- needed for authenticated vendor users to read and update availability only.
GRANT SELECT, UPDATE ON TABLE public.dishes TO authenticated;

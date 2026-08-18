-- P0 verification support: service_role is a server-only Supabase role that
-- bypasses RLS but still needs explicit table privileges on newly created
-- tables. Grant only INSERT so trusted operational tooling and the isolated
-- live RLS suite can provision canonical vendor/admin role rows. Client roles
-- retain no INSERT, UPDATE, or DELETE privilege and remain constrained by RLS.
GRANT INSERT ON TABLE public.user_roles TO service_role;

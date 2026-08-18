-- P0 verification support: the server-only service_role provisions isolated
-- test fixtures and performs cleanup after live staging checks. It bypasses
-- RLS but still requires explicit table privileges. These grants are limited
-- to the exact non-client operations used by the RLS, checkout, and address
-- suites; anon and authenticated retain no new privilege.
GRANT UPDATE ON TABLE public.profiles TO service_role;
GRANT INSERT, DELETE ON TABLE public.user_roles TO service_role;
GRANT INSERT, SELECT, DELETE ON TABLE public.addresses TO service_role;
GRANT INSERT, DELETE ON TABLE public.dishes TO service_role;
GRANT SELECT, DELETE ON TABLE public.orders TO service_role;

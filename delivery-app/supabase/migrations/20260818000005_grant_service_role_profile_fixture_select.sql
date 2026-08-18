-- P0 verification support: the server-only service_role fixture client updates
-- a temporary legacy profile row through PostgREST. The returned representation
-- requires SELECT in addition to the existing UPDATE fixture grant.
-- No client-facing role, RLS policy, or production target is affected.
GRANT SELECT ON TABLE public.profiles TO service_role;

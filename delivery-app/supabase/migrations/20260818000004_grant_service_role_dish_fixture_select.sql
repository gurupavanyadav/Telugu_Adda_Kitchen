-- P0 verification support: the server-only service_role reads back the
-- isolated dish fixture after inserting it through PostgREST. This is
-- required because the fixture explicitly requests the generated row with
-- RETURNING semantics. Client-facing roles receive no additional privilege.
GRANT SELECT ON TABLE public.dishes TO service_role;

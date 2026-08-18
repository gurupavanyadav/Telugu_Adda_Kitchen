-- P0 address access repair: restore the table-level permission ceiling needed
-- for the existing authenticated owner-scoped address RLS policies to operate.
-- RLS remains enabled and is the enforcement boundary for row ownership.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.addresses TO authenticated;

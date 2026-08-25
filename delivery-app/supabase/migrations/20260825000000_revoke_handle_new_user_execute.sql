-- Prevent public API callers from invoking the SECURITY DEFINER sign-up trigger.
-- The on_auth_user_created trigger continues to execute this function internally.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;

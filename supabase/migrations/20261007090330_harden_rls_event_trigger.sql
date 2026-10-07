-- The platform event trigger is internal; it must not be callable from the API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

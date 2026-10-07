-- Profiles are provisioned by the auth trigger, not by browser-side inserts.
revoke insert, delete on public.profiles from authenticated;
drop policy profiles_owner on public.profiles;
create policy profiles_select_owner on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_owner on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

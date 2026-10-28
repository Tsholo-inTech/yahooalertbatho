alter table public.profiles enable row level security;

grant select, insert on public.profiles to authenticated;

drop policy if exists "Users can view their own profile"
  on public.profiles;

create policy "Users can view their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can create their own profile"
  on public.profiles;

create policy "Users can create their own profile"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

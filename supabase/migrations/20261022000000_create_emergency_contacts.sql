create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  phone text not null check (char_length(phone) between 7 and 32),
  relationship text not null default '' check (char_length(relationship) <= 50),
  created_at timestamptz not null default now(),
  unique (user_id, phone)
);

create index if not exists emergency_contacts_user_created_idx
  on public.emergency_contacts (user_id, created_at);

alter table public.emergency_contacts enable row level security;

create policy "Users can view their emergency contacts"
  on public.emergency_contacts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their emergency contacts"
  on public.emergency_contacts
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can remove their emergency contacts"
  on public.emergency_contacts
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.emergency_contacts to authenticated;

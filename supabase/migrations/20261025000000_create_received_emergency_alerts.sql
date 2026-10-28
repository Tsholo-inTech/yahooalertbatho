create table if not exists public.received_emergency_alerts (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.emergency_reports (id) on delete cascade,
  sender_user_id uuid not null references auth.users (id) on delete cascade,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  sender_name text not null,
  incident_type text not null,
  description text not null default '',
  latitude double precision,
  longitude double precision,
  received_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'resolved')),
  unique (report_id, recipient_user_id),
  check (
    (latitude is null and longitude is null)
    or (
      latitude is not null
      and longitude is not null
      and latitude between -90 and 90
      and longitude between -180 and 180
    )
  )
);

create index if not exists received_emergency_alerts_recipient_status_idx
  on public.received_emergency_alerts (recipient_user_id, status, received_at desc);

alter table public.received_emergency_alerts enable row level security;

grant select on public.received_emergency_alerts to authenticated;
grant update (status) on public.received_emergency_alerts to authenticated;
grant insert, select on public.received_emergency_alerts to service_role;

drop policy if exists "Recipients can view received emergency alerts"
  on public.received_emergency_alerts;

create policy "Recipients can view received emergency alerts"
  on public.received_emergency_alerts
  for select
  to authenticated
  using ((select auth.uid()) = recipient_user_id);

drop policy if exists "Recipients can resolve received emergency alerts"
  on public.received_emergency_alerts;

create policy "Recipients can resolve received emergency alerts"
  on public.received_emergency_alerts
  for update
  to authenticated
  using ((select auth.uid()) = recipient_user_id)
  with check ((select auth.uid()) = recipient_user_id);

create or replace function public.find_verified_emergency_alert_recipients(target_phones text[])
returns table (phone text, user_id uuid)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select users.phone, users.id
  from auth.users as users
  where users.phone = any(target_phones)
    and users.phone_confirmed_at is not null;
$$;

revoke all on function public.find_verified_emergency_alert_recipients(text[]) from public;
revoke all on function public.find_verified_emergency_alert_recipients(text[]) from anon, authenticated;
grant execute on function public.find_verified_emergency_alert_recipients(text[]) to service_role;

drop policy if exists "Users can view their own emergency report updates"
  on public.emergency_report_updates;

create policy "Users can view their own emergency report updates"
  on public.emergency_report_updates
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1
      from public.emergency_reports as report
      where report.id = emergency_report_updates.report_id
        and report.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can add updates to their own emergency reports"
  on public.emergency_report_updates;

create policy "Users and alert recipients can add emergency updates"
  on public.emergency_report_updates
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      exists (
        select 1
        from public.emergency_reports as report
        where report.id = emergency_report_updates.report_id
          and report.user_id = (select auth.uid())
      )
      or exists (
        select 1
        from public.received_emergency_alerts as received
        where received.report_id = emergency_report_updates.report_id
          and received.recipient_user_id = (select auth.uid())
      )
    )
  );

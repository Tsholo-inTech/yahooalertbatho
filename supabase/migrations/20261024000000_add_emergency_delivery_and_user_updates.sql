alter table public.emergency_reports
  add column if not exists delivery_status text not null default 'sending'
    check (delivery_status in ('saved_offline', 'sending', 'sent', 'failed')),
  add column if not exists delivery_details text not null default '';

grant update (delivery_status, delivery_details) on public.emergency_reports to authenticated;

-- 1. Drop the correct policy before creating it
drop policy if exists "Users can update delivery status for their own reports" on public.emergency_reports;

create policy "Users can update delivery status for their own reports"
  on public.emergency_reports
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.emergency_report_updates (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.emergency_reports (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  update_status text not null
    check (update_status in ('I am safe', 'Need more help', 'False alarm')),
  created_at timestamptz not null default now()
);

create index if not exists emergency_report_updates_report_created_idx
  on public.emergency_report_updates (report_id, created_at desc);

alter table public.emergency_report_updates enable row level security;

grant select, insert on public.emergency_report_updates to authenticated;

-- 2. Drop before creating
drop policy if exists "Users can view their own emergency report updates" on public.emergency_report_updates;

create policy "Users can view their own emergency report updates"
  on public.emergency_report_updates
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- 3. Drop before creating
drop policy if exists "Users can add updates to their own emergency reports" on public.emergency_report_updates;

create policy "Users can add updates to their own emergency reports"
  on public.emergency_report_updates
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.emergency_reports as report
      where report.id = emergency_report_updates.report_id
        and report.user_id = (select auth.uid())
    )
  );
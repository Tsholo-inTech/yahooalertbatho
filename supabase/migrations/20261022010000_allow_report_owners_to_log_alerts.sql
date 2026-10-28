alter table public.alerts_log enable row level security;

grant insert on public.alerts_log to authenticated;

drop policy if exists "Users can add logs for their own reports"
  on public.alerts_log;

create policy "Users can add logs for their own reports"
  on public.alerts_log
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.emergency_reports as report
      where report.id = alerts_log.report_id
        and report.user_id = (select auth.uid())
    )
  );

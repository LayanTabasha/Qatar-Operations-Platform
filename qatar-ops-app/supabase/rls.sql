-- Row Level Security policies for Supabase.
-- Run after schema.sql and after creating the first Administrator profile.

alter table roles enable row level security;
alter table profiles enable row level security;
alter table sites enable row level security;
alter table chargers enable row level security;
alter table site_visits enable row level security;
alter table faults enable row level security;
alter table documents enable row level security;
alter table weekly_reports enable row level security;
alter table troubleshooting_guides enable row level security;
alter table permissions enable row level security;

create or replace function current_profile_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select roles.name
  from profiles
  join roles on roles.id = profiles.role_id
  where profiles.auth_user_id = auth.uid()
    and profiles.account_status = 'Active'
  limit 1;
$$;

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select current_profile_role() = 'Administrator';
$$;

create policy "authenticated users can read roles"
on roles for select
to authenticated
using (true);

create policy "admins manage roles"
on roles for all
to authenticated
using (is_admin())
with check (is_admin());

create policy "users read own profile"
on profiles for select
to authenticated
using (auth_user_id = auth.uid() or is_admin());

create policy "admins manage profiles"
on profiles for all
to authenticated
using (is_admin())
with check (is_admin());

create policy "authenticated read sites"
on sites for select
to authenticated
using (current_profile_role() in ('Administrator', 'Operations Staff', 'Viewer'));

create policy "admins manage sites"
on sites for all
to authenticated
using (is_admin())
with check (is_admin());

create policy "authenticated read chargers"
on chargers for select
to authenticated
using (current_profile_role() in ('Administrator', 'Operations Staff', 'Viewer'));

create policy "admins manage chargers"
on chargers for all
to authenticated
using (is_admin())
with check (is_admin());

create policy "authenticated read visits"
on site_visits for select
to authenticated
using (current_profile_role() in ('Administrator', 'Operations Staff', 'Viewer'));

create policy "ops create visits"
on site_visits for insert
to authenticated
with check (current_profile_role() in ('Administrator', 'Operations Staff'));

create policy "authenticated read faults"
on faults for select
to authenticated
using (current_profile_role() in ('Administrator', 'Operations Staff', 'Viewer'));

create policy "ops create faults"
on faults for insert
to authenticated
with check (current_profile_role() in ('Administrator', 'Operations Staff'));

create policy "authenticated read documents"
on documents for select
to authenticated
using (current_profile_role() in ('Administrator', 'Operations Staff', 'Viewer'));

create policy "ops create documents"
on documents for insert
to authenticated
with check (current_profile_role() in ('Administrator', 'Operations Staff'));

create policy "authenticated read weekly reports"
on weekly_reports for select
to authenticated
using (current_profile_role() in ('Administrator', 'Operations Staff', 'Viewer'));

create policy "ops create weekly reports"
on weekly_reports for insert
to authenticated
with check (current_profile_role() in ('Administrator', 'Operations Staff'));

create policy "authenticated read troubleshooting"
on troubleshooting_guides for select
to authenticated
using (current_profile_role() in ('Administrator', 'Operations Staff', 'Viewer'));

create policy "admins manage troubleshooting"
on troubleshooting_guides for all
to authenticated
using (is_admin())
with check (is_admin());

create policy "admins manage permissions"
on permissions for all
to authenticated
using (is_admin())
with check (is_admin());

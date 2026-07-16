-- Zeeda Energy Qatar Operations Platform
-- Production backend foundation for Supabase.
-- Apply after creating a Supabase project. Buckets remain private.

create extension if not exists pgcrypto;

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('Administrator', 'Operations Staff', 'Viewer')),
  description text,
  created_at timestamptz not null default now()
);

insert into public.roles (name, description)
values
  ('Administrator', 'Full system access'),
  ('Operations Staff', 'Operational record access without user or role management'),
  ('Viewer', 'Read-only access')
on conflict (name) do nothing;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role_id uuid not null references public.roles(id),
  account_status text not null default 'Invited' check (account_status in ('Invited', 'Active', 'Disabled', 'Locked')),
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  last_login_at timestamptz
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  location text,
  status text not null default 'Pending Data',
  client_organization text,
  description text,
  notes text,
  image_file_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chargers (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  name text not null,
  type text,
  serial_number text,
  manufacturer text,
  model text,
  capacity text,
  status text not null default 'Pending Data',
  installation_date date,
  operator text,
  administrator text,
  image_file_id uuid,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, name)
);

create table if not exists public.fault_catalogue (
  id uuid primary key default gen_random_uuid(),
  fault_code text not null unique,
  fault_name text not null,
  meaning text,
  severity text,
  recommended_action text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  charger_id uuid not null references public.chargers(id) on delete restrict,
  visit_date date,
  time_in time,
  time_out time,
  visit_type text,
  status text not null default 'Scheduled' check (status in ('Scheduled', 'Completed', 'Cancelled', 'Follow-Up Required')),
  engineer_name text,
  technician_name text,
  purpose text,
  work_completed text,
  findings text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (time_out is null or time_in is null or time_out >= time_in)
);

create table if not exists public.faults (
  id uuid primary key default gen_random_uuid(),
  fault_id text not null unique,
  site_id uuid not null references public.sites(id) on delete restrict,
  charger_id uuid not null references public.chargers(id) on delete restrict,
  fault_catalogue_id uuid references public.fault_catalogue(id),
  fault_code text,
  fault_name text,
  fault_description text,
  severity text,
  recommended_action text,
  status text not null default 'Open' check (status in ('Open', 'In Progress', 'Resolved', 'Closed')),
  reported_at timestamptz not null default now(),
  description text,
  comments text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  bucket_name text not null,
  original_file_name text not null,
  storage_path text not null unique,
  mime_type text,
  file_size bigint,
  uploaded_by uuid references public.profiles(id),
  uploaded_at timestamptz not null default now(),
  site_id uuid references public.sites(id) on delete restrict,
  charger_id uuid references public.chargers(id) on delete restrict,
  related_record_id uuid,
  document_type text not null check (document_type in ('site_visit_report', 'charger_document', 'fault_photo', 'weekly_report', 'troubleshooting_guide', 'site_image', 'charger_image', 'needs_classification')),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.site_visit_reports (
  id uuid primary key default gen_random_uuid(),
  site_visit_id uuid not null references public.site_visits(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (site_visit_id, file_id)
);

create table if not exists public.charger_documents (
  id uuid primary key default gen_random_uuid(),
  charger_id uuid not null references public.chargers(id) on delete restrict,
  category text not null,
  description text,
  file_id uuid not null references public.files(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.fault_photos (
  id uuid primary key default gen_random_uuid(),
  fault_id uuid not null references public.faults(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  charger_id uuid not null references public.chargers(id) on delete restrict,
  week_start_date date not null,
  week_end_date date not null,
  report_title text,
  summary text,
  file_id uuid references public.files(id) on delete restrict,
  uploaded_by uuid references public.profiles(id),
  uploaded_at timestamptz not null default now(),
  version integer not null default 1,
  check (week_end_date >= week_start_date)
);

create table if not exists public.troubleshooting_guides (
  id uuid primary key default gen_random_uuid(),
  charger_id uuid references public.chargers(id) on delete restrict,
  fault_catalogue_id uuid references public.fault_catalogue(id),
  guide_title text not null,
  category text,
  version text,
  description text,
  file_id uuid references public.files(id) on delete restrict,
  uploaded_by uuid references public.profiles(id),
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  action_type text not null,
  entity_type text not null,
  entity_id text,
  description text not null,
  user_id uuid references public.profiles(id),
  user_name text,
  site_id uuid references public.sites(id),
  charger_id uuid references public.chargers(id),
  occurred_at timestamptz not null default now()
);

create or replace function public.current_profile_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select roles.name
  from public.profiles
  join public.roles on roles.id = profiles.role_id
  where profiles.auth_user_id = auth.uid()
    and profiles.account_status = 'Active'
  limit 1;
$$;

create or replace function public.current_profile_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id
  from public.profiles
  where auth_user_id = auth.uid()
    and account_status = 'Active'
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_profile_role() = 'Administrator';
$$;

alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.chargers enable row level security;
alter table public.fault_catalogue enable row level security;
alter table public.site_visits enable row level security;
alter table public.faults enable row level security;
alter table public.files enable row level security;
alter table public.site_visit_reports enable row level security;
alter table public.charger_documents enable row level security;
alter table public.fault_photos enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.troubleshooting_guides enable row level security;
alter table public.activity_log enable row level security;

create policy "read roles authenticated" on public.roles for select to authenticated using (true);
create policy "manage roles admin" on public.roles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "read own profile or admin" on public.profiles for select to authenticated using (auth_user_id = auth.uid() or public.is_admin());
create policy "manage profiles admin" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "read operations data" on public.sites for select to authenticated using (public.current_profile_role() in ('Administrator', 'Operations Staff', 'Viewer'));
create policy "manage sites admin" on public.sites for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "read chargers" on public.chargers for select to authenticated using (public.current_profile_role() in ('Administrator', 'Operations Staff', 'Viewer'));
create policy "manage chargers admin" on public.chargers for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "read fault catalogue" on public.fault_catalogue for select to authenticated using (public.current_profile_role() in ('Administrator', 'Operations Staff', 'Viewer'));
create policy "manage fault catalogue admin" on public.fault_catalogue for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "read site visits" on public.site_visits for select to authenticated using (public.current_profile_role() in ('Administrator', 'Operations Staff', 'Viewer'));
create policy "create site visits ops" on public.site_visits for insert to authenticated with check (public.current_profile_role() in ('Administrator', 'Operations Staff'));

create policy "read faults" on public.faults for select to authenticated using (public.current_profile_role() in ('Administrator', 'Operations Staff', 'Viewer'));
create policy "create faults ops" on public.faults for insert to authenticated with check (public.current_profile_role() in ('Administrator', 'Operations Staff'));
create policy "update faults ops" on public.faults for update to authenticated using (public.current_profile_role() in ('Administrator', 'Operations Staff')) with check (public.current_profile_role() in ('Administrator', 'Operations Staff'));

create policy "read files metadata" on public.files for select to authenticated using (public.current_profile_role() in ('Administrator', 'Operations Staff', 'Viewer'));
create policy "create files metadata ops" on public.files for insert to authenticated with check (public.current_profile_role() in ('Administrator', 'Operations Staff'));

create policy "read site visit reports" on public.site_visit_reports for select to authenticated using (public.current_profile_role() in ('Administrator', 'Operations Staff', 'Viewer'));
create policy "create site visit reports ops" on public.site_visit_reports for insert to authenticated with check (public.current_profile_role() in ('Administrator', 'Operations Staff'));

create policy "read charger documents" on public.charger_documents for select to authenticated using (public.current_profile_role() in ('Administrator', 'Operations Staff', 'Viewer'));
create policy "create charger documents ops" on public.charger_documents for insert to authenticated with check (public.current_profile_role() in ('Administrator', 'Operations Staff'));

create policy "read fault photos" on public.fault_photos for select to authenticated using (public.current_profile_role() in ('Administrator', 'Operations Staff', 'Viewer'));
create policy "create fault photos ops" on public.fault_photos for insert to authenticated with check (public.current_profile_role() in ('Administrator', 'Operations Staff'));

create policy "read weekly reports" on public.weekly_reports for select to authenticated using (public.current_profile_role() in ('Administrator', 'Operations Staff', 'Viewer'));
create policy "create weekly reports ops" on public.weekly_reports for insert to authenticated with check (public.current_profile_role() in ('Administrator', 'Operations Staff'));

create policy "read troubleshooting guides" on public.troubleshooting_guides for select to authenticated using (public.current_profile_role() in ('Administrator', 'Operations Staff', 'Viewer'));
create policy "create troubleshooting guides ops" on public.troubleshooting_guides for insert to authenticated with check (public.current_profile_role() in ('Administrator', 'Operations Staff'));
create policy "manage troubleshooting guides admin" on public.troubleshooting_guides for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "read activity log" on public.activity_log for select to authenticated using (public.current_profile_role() in ('Administrator', 'Operations Staff', 'Viewer'));
create policy "create activity log authenticated" on public.activity_log for insert to authenticated with check (public.current_profile_role() in ('Administrator', 'Operations Staff', 'Viewer'));

insert into storage.buckets (id, name, public)
values
  ('site-images', 'site-images', false),
  ('charger-documents', 'charger-documents', false),
  ('site-visit-reports', 'site-visit-reports', false),
  ('fault-photos', 'fault-photos', false),
  ('weekly-reports', 'weekly-reports', false),
  ('troubleshooting-guides', 'troubleshooting-guides', false),
  ('preview-files', 'preview-files', false)
on conflict (id) do update set public = excluded.public;

create policy "authenticated read private operation objects"
on storage.objects for select
to authenticated
using (
  bucket_id in ('site-images', 'charger-documents', 'site-visit-reports', 'fault-photos', 'weekly-reports', 'troubleshooting-guides', 'preview-files')
  and public.current_profile_role() in ('Administrator', 'Operations Staff', 'Viewer')
);

create policy "ops upload private operation objects"
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('site-images', 'charger-documents', 'site-visit-reports', 'fault-photos', 'weekly-reports', 'troubleshooting-guides', 'preview-files')
  and public.current_profile_role() in ('Administrator', 'Operations Staff')
);

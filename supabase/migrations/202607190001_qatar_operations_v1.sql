-- Zeeda Energy Qatar Operations Platform
-- Supabase V1 backend foundation for the active root HTML/CSS/JavaScript app.
-- This migration is self-contained for a new Supabase development project.
-- It does not create real users, passwords, API keys, or service-role secrets.

-- ==================================================
-- Extensions
-- ==================================================

create extension if not exists pgcrypto;

-- ==================================================
-- Core Tables: Roles And Profiles
-- ==================================================

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('Administrator', 'Operations Staff', 'Viewer')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.roles (name, description)
values
  ('Administrator', 'Full system access'),
  ('Operations Staff', 'Operational record access without user and role management'),
  ('Viewer', 'Read-only operational access')
on conflict (name) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role_id uuid not null references public.roles(id) on delete restrict,
  account_status text not null default 'Invited' check (account_status in ('Invited', 'Active', 'Suspended', 'Disabled')),
  must_change_password boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- First Administrator bootstrap note:
-- 1. Create the first Supabase Auth user through the Supabase dashboard or another trusted server-side process.
-- 2. Use the Supabase SQL editor or a trusted service-role backend to set that user's profile role to Administrator
--    and account_status to Active.
-- 3. Do not expose a public signup screen that can create active Administrator accounts.

-- ==================================================
-- Operational Tables
-- ==================================================

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  location text,
  status text not null default 'Pending Data',
  client_organization text,
  description text,
  notes text,
  is_archived boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chargers (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  name text not null,
  charger_code text,
  type text,
  serial_number text,
  manufacturer text,
  model text,
  operator_name text,
  administrator_name text,
  delivered_power numeric(12, 2),
  charging_sessions integer,
  capacity text,
  status text not null default 'Pending Data',
  installation_date date,
  notes text,
  is_archived boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, id),
  unique (site_id, name),
  unique (site_id, charger_code),
  check (charging_sessions is null or charging_sessions >= 0)
);

create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  charger_id uuid,
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
  is_archived boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (time_out is null or time_in is null or time_out >= time_in),
  foreign key (site_id, charger_id) references public.chargers(site_id, id) on delete restrict
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

create table if not exists public.faults (
  id uuid primary key default gen_random_uuid(),
  fault_reference text not null unique,
  site_id uuid not null references public.sites(id) on delete restrict,
  charger_id uuid not null,
  fault_catalogue_id uuid references public.fault_catalogue(id) on delete set null,
  fault_code text,
  fault_name text,
  severity text,
  status text not null default 'Open' check (status in ('Open', 'In Progress', 'Resolved', 'Closed')),
  reported_at timestamptz not null default now(),
  resolved_at timestamptz,
  description text,
  resolution text,
  comments text,
  requires_site_visit boolean not null default false,
  related_site_visit_id uuid references public.site_visits(id) on delete set null,
  is_archived boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (resolved_at is null or resolved_at >= reported_at),
  foreign key (site_id, charger_id) references public.chargers(site_id, id) on delete restrict
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete restrict,
  contact_name text not null,
  organization text,
  job_title text,
  email text,
  phone text,
  contact_type text,
  notes text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==================================================
-- Files And Document Relationship Tables
-- ==================================================

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  bucket_name text not null,
  original_file_name text not null,
  storage_path text not null unique,
  mime_type text,
  file_size bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  site_id uuid references public.sites(id) on delete restrict,
  charger_id uuid,
  document_type text not null check (document_type in ('site_image', 'charger_image', 'charger_document', 'site_visit_report', 'fault_photo', 'weekly_report', 'troubleshooting_guide', 'needs_classification')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (file_size is null or file_size >= 0),
  foreign key (site_id, charger_id) references public.chargers(site_id, id) on delete restrict
);

alter table public.sites
  add column if not exists image_file_id uuid references public.files(id) on delete set null;

alter table public.chargers
  add column if not exists image_file_id uuid references public.files(id) on delete set null;

create table if not exists public.site_images (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete restrict,
  is_primary boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (site_id, file_id)
);

create table if not exists public.charger_images (
  id uuid primary key default gen_random_uuid(),
  charger_id uuid not null references public.chargers(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete restrict,
  is_primary boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (charger_id, file_id)
);

create table if not exists public.charger_documents (
  id uuid primary key default gen_random_uuid(),
  charger_id uuid not null references public.chargers(id) on delete restrict,
  category text not null,
  description text,
  file_id uuid not null references public.files(id) on delete restrict,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (charger_id, file_id)
);

create table if not exists public.site_visit_reports (
  id uuid primary key default gen_random_uuid(),
  site_visit_id uuid not null references public.site_visits(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete restrict,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (site_visit_id, file_id)
);

create table if not exists public.fault_photos (
  id uuid primary key default gen_random_uuid(),
  fault_id uuid not null references public.faults(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete restrict,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (fault_id, file_id)
);

create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  charger_id uuid,
  week_start_date date not null,
  week_end_date date not null,
  report_title text,
  summary text,
  file_id uuid references public.files(id) on delete restrict,
  version integer not null default 1,
  is_archived boolean not null default false,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (week_end_date >= week_start_date),
  check (version >= 1),
  foreign key (site_id, charger_id) references public.chargers(site_id, id) on delete restrict
);

create table if not exists public.troubleshooting_guides (
  id uuid primary key default gen_random_uuid(),
  charger_id uuid references public.chargers(id) on delete restrict,
  fault_catalogue_id uuid references public.fault_catalogue(id) on delete set null,
  guide_title text not null,
  category text,
  version text,
  description text,
  file_id uuid references public.files(id) on delete restrict,
  active boolean not null default true,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==================================================
-- Activity Log
-- ==================================================

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  action_type text not null,
  entity_type text not null,
  entity_id text,
  description text not null,
  user_id uuid references public.profiles(id) on delete set null,
  user_name text,
  site_id uuid references public.sites(id) on delete set null,
  charger_id uuid references public.chargers(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

-- Application actions should create activity records through public.create_activity_log()
-- from a trusted server-side process. Future database triggers may also call it.
-- Browser clients are intentionally not granted direct insert/update/delete access.

-- ==================================================
-- Helper Functions
-- ==================================================

create or replace function public.current_profile_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select profiles.id
  from public.profiles
  where profiles.id = auth.uid()
    and profiles.account_status = 'Active'
  limit 1;
$$;

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
  where profiles.id = auth.uid()
    and profiles.account_status = 'Active'
  limit 1;
$$;

create or replace function public.is_active_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.account_status = 'Active'
  );
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

create or replace function public.is_operations_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_profile_role() in ('Administrator', 'Operations Staff');
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_role_id uuid;
begin
  select id into viewer_role_id
  from public.roles
  where name = 'Viewer';

  insert into public.profiles (
    id,
    full_name,
    email,
    role_id,
    account_status,
    must_change_password
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'Invited User'),
    coalesce(new.email, concat(new.id::text, '@pending.local')),
    viewer_role_id,
    'Invited',
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.create_activity_log(
  p_action_type text,
  p_entity_type text,
  p_entity_id text,
  p_description text,
  p_user_id uuid default null,
  p_user_name text default null,
  p_site_id uuid default null,
  p_charger_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_activity_id uuid;
begin
  if p_action_type is null or length(trim(p_action_type)) = 0 then
    raise exception 'action_type is required';
  end if;

  if p_entity_type is null or length(trim(p_entity_type)) = 0 then
    raise exception 'entity_type is required';
  end if;

  if p_description is null or length(trim(p_description)) = 0 then
    raise exception 'description is required';
  end if;

  insert into public.activity_log (
    action_type,
    entity_type,
    entity_id,
    description,
    user_id,
    user_name,
    site_id,
    charger_id,
    metadata
  )
  values (
    p_action_type,
    p_entity_type,
    p_entity_id,
    p_description,
    p_user_id,
    p_user_name,
    p_site_id,
    p_charger_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into new_activity_id;

  return new_activity_id;
end;
$$;

revoke all on function public.current_profile_id() from public, anon;
revoke all on function public.current_profile_role() from public, anon;
revoke all on function public.is_active_user() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_operations_staff() from public, anon;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.create_activity_log(text, text, text, text, uuid, text, uuid, uuid, jsonb) from public, anon, authenticated;

grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_operations_staff() to authenticated;
grant execute on function public.create_activity_log(text, text, text, text, uuid, text, uuid, uuid, jsonb) to service_role;

-- ==================================================
-- Triggers
-- ==================================================

drop trigger if exists on_auth_user_created_create_invited_profile on auth.users;
create trigger on_auth_user_created_create_invited_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

drop trigger if exists set_roles_updated_at on public.roles;
create trigger set_roles_updated_at before update on public.roles for each row execute function public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists set_sites_updated_at on public.sites;
create trigger set_sites_updated_at before update on public.sites for each row execute function public.set_updated_at();

drop trigger if exists set_chargers_updated_at on public.chargers;
create trigger set_chargers_updated_at before update on public.chargers for each row execute function public.set_updated_at();

drop trigger if exists set_site_visits_updated_at on public.site_visits;
create trigger set_site_visits_updated_at before update on public.site_visits for each row execute function public.set_updated_at();

drop trigger if exists set_fault_catalogue_updated_at on public.fault_catalogue;
create trigger set_fault_catalogue_updated_at before update on public.fault_catalogue for each row execute function public.set_updated_at();

drop trigger if exists set_faults_updated_at on public.faults;
create trigger set_faults_updated_at before update on public.faults for each row execute function public.set_updated_at();

drop trigger if exists set_contacts_updated_at on public.contacts;
create trigger set_contacts_updated_at before update on public.contacts for each row execute function public.set_updated_at();

drop trigger if exists set_files_updated_at on public.files;
create trigger set_files_updated_at before update on public.files for each row execute function public.set_updated_at();

drop trigger if exists set_charger_documents_updated_at on public.charger_documents;
create trigger set_charger_documents_updated_at before update on public.charger_documents for each row execute function public.set_updated_at();

drop trigger if exists set_weekly_reports_updated_at on public.weekly_reports;
create trigger set_weekly_reports_updated_at before update on public.weekly_reports for each row execute function public.set_updated_at();

drop trigger if exists set_troubleshooting_guides_updated_at on public.troubleshooting_guides;
create trigger set_troubleshooting_guides_updated_at before update on public.troubleshooting_guides for each row execute function public.set_updated_at();

-- ==================================================
-- Indexes
-- ==================================================

create index if not exists idx_profiles_role_id on public.profiles(role_id);
create index if not exists idx_profiles_account_status on public.profiles(account_status);
create index if not exists idx_chargers_site_id on public.chargers(site_id);
create index if not exists idx_site_visits_site_id on public.site_visits(site_id);
create index if not exists idx_site_visits_charger_id on public.site_visits(charger_id);
create index if not exists idx_site_visits_visit_date on public.site_visits(visit_date);
create index if not exists idx_faults_site_id on public.faults(site_id);
create index if not exists idx_faults_charger_id on public.faults(charger_id);
create index if not exists idx_faults_status on public.faults(status);
create index if not exists idx_faults_reported_at on public.faults(reported_at);
create index if not exists idx_files_site_id on public.files(site_id);
create index if not exists idx_files_charger_id on public.files(charger_id);
create index if not exists idx_files_uploaded_by on public.files(uploaded_by);
create index if not exists idx_weekly_reports_site_id on public.weekly_reports(site_id);
create index if not exists idx_weekly_reports_week_start_date on public.weekly_reports(week_start_date);
create index if not exists idx_activity_log_occurred_at on public.activity_log(occurred_at);
create index if not exists idx_activity_log_site_id on public.activity_log(site_id);
create index if not exists idx_activity_log_charger_id on public.activity_log(charger_id);
create index if not exists idx_contacts_site_id on public.contacts(site_id);

-- ==================================================
-- Row Level Security
-- ==================================================

alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.chargers enable row level security;
alter table public.site_visits enable row level security;
alter table public.fault_catalogue enable row level security;
alter table public.faults enable row level security;
alter table public.contacts enable row level security;
alter table public.files enable row level security;
alter table public.site_images enable row level security;
alter table public.charger_images enable row level security;
alter table public.charger_documents enable row level security;
alter table public.site_visit_reports enable row level security;
alter table public.fault_photos enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.troubleshooting_guides enable row level security;
alter table public.activity_log enable row level security;

-- ==================================================
-- Policies
-- ==================================================

drop policy if exists "roles_select_active_authenticated" on public.roles;
create policy "roles_select_active_authenticated"
on public.roles for select
to authenticated
using (public.is_active_user());

drop policy if exists "roles_insert_admin" on public.roles;
create policy "roles_insert_admin"
on public.roles for insert
to authenticated
with check (public.is_admin());

drop policy if exists "roles_update_admin" on public.roles;
create policy "roles_update_admin"
on public.roles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin"
on public.profiles for insert
to authenticated
with check (public.is_admin());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "sites_select_active_users" on public.sites;
create policy "sites_select_active_users"
on public.sites for select
to authenticated
using (public.is_admin() or (public.is_active_user() and is_archived = false));

drop policy if exists "sites_insert_admin" on public.sites;
drop policy if exists "sites_insert_ops" on public.sites;
create policy "sites_insert_ops"
on public.sites for insert
to authenticated
with check (public.is_operations_staff());

drop policy if exists "sites_update_admin" on public.sites;
drop policy if exists "sites_update_ops" on public.sites;
create policy "sites_update_ops"
on public.sites for update
to authenticated
using (public.is_operations_staff())
with check (public.is_operations_staff());

drop policy if exists "chargers_select_active_users" on public.chargers;
create policy "chargers_select_active_users"
on public.chargers for select
to authenticated
using (public.is_admin() or (public.is_active_user() and is_archived = false));

drop policy if exists "chargers_insert_admin" on public.chargers;
drop policy if exists "chargers_insert_ops" on public.chargers;
create policy "chargers_insert_ops"
on public.chargers for insert
to authenticated
with check (public.is_operations_staff());

drop policy if exists "chargers_update_admin" on public.chargers;
drop policy if exists "chargers_update_ops" on public.chargers;
create policy "chargers_update_ops"
on public.chargers for update
to authenticated
using (public.is_operations_staff())
with check (public.is_operations_staff());

drop policy if exists "fault_catalogue_select_active_users" on public.fault_catalogue;
create policy "fault_catalogue_select_active_users"
on public.fault_catalogue for select
to authenticated
using (public.is_active_user());

drop policy if exists "fault_catalogue_insert_admin" on public.fault_catalogue;
create policy "fault_catalogue_insert_admin"
on public.fault_catalogue for insert
to authenticated
with check (public.is_admin());

drop policy if exists "fault_catalogue_update_admin" on public.fault_catalogue;
create policy "fault_catalogue_update_admin"
on public.fault_catalogue for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "site_visits_select_active_users" on public.site_visits;
create policy "site_visits_select_active_users"
on public.site_visits for select
to authenticated
using (public.is_admin() or (public.is_active_user() and is_archived = false));

drop policy if exists "site_visits_insert_ops" on public.site_visits;
create policy "site_visits_insert_ops"
on public.site_visits for insert
to authenticated
with check (public.is_operations_staff());

drop policy if exists "site_visits_update_ops" on public.site_visits;
create policy "site_visits_update_ops"
on public.site_visits for update
to authenticated
using (public.is_operations_staff())
with check (public.is_operations_staff());

drop policy if exists "faults_select_active_users" on public.faults;
create policy "faults_select_active_users"
on public.faults for select
to authenticated
using (public.is_admin() or (public.is_active_user() and is_archived = false));

drop policy if exists "faults_insert_ops" on public.faults;
create policy "faults_insert_ops"
on public.faults for insert
to authenticated
with check (public.is_operations_staff());

drop policy if exists "faults_update_ops" on public.faults;
create policy "faults_update_ops"
on public.faults for update
to authenticated
using (public.is_operations_staff())
with check (public.is_operations_staff());

drop policy if exists "contacts_select_active_users" on public.contacts;
create policy "contacts_select_active_users"
on public.contacts for select
to authenticated
using (public.is_admin() or (public.is_active_user() and active = true));

drop policy if exists "contacts_insert_ops" on public.contacts;
create policy "contacts_insert_ops"
on public.contacts for insert
to authenticated
with check (public.is_operations_staff());

drop policy if exists "contacts_update_ops" on public.contacts;
create policy "contacts_update_ops"
on public.contacts for update
to authenticated
using (public.is_operations_staff())
with check (public.is_operations_staff());

drop policy if exists "files_select_active_users" on public.files;
create policy "files_select_active_users"
on public.files for select
to authenticated
using (public.is_active_user());

drop policy if exists "files_insert_ops" on public.files;
create policy "files_insert_ops"
on public.files for insert
to authenticated
with check (public.is_operations_staff());

drop policy if exists "files_update_ops" on public.files;
create policy "files_update_ops"
on public.files for update
to authenticated
using (public.is_operations_staff())
with check (public.is_operations_staff());

drop policy if exists "site_images_select_active_users" on public.site_images;
create policy "site_images_select_active_users"
on public.site_images for select
to authenticated
using (public.is_active_user());

drop policy if exists "site_images_insert_ops" on public.site_images;
create policy "site_images_insert_ops"
on public.site_images for insert
to authenticated
with check (public.is_operations_staff());

drop policy if exists "charger_images_select_active_users" on public.charger_images;
create policy "charger_images_select_active_users"
on public.charger_images for select
to authenticated
using (public.is_active_user());

drop policy if exists "charger_images_insert_ops" on public.charger_images;
create policy "charger_images_insert_ops"
on public.charger_images for insert
to authenticated
with check (public.is_operations_staff());

drop policy if exists "charger_documents_select_active_users" on public.charger_documents;
create policy "charger_documents_select_active_users"
on public.charger_documents for select
to authenticated
using (public.is_active_user());

drop policy if exists "charger_documents_insert_ops" on public.charger_documents;
create policy "charger_documents_insert_ops"
on public.charger_documents for insert
to authenticated
with check (public.is_operations_staff());

drop policy if exists "charger_documents_update_ops" on public.charger_documents;
create policy "charger_documents_update_ops"
on public.charger_documents for update
to authenticated
using (public.is_operations_staff())
with check (public.is_operations_staff());

drop policy if exists "site_visit_reports_select_active_users" on public.site_visit_reports;
create policy "site_visit_reports_select_active_users"
on public.site_visit_reports for select
to authenticated
using (public.is_active_user());

drop policy if exists "site_visit_reports_insert_ops" on public.site_visit_reports;
create policy "site_visit_reports_insert_ops"
on public.site_visit_reports for insert
to authenticated
with check (public.is_operations_staff());

drop policy if exists "fault_photos_select_active_users" on public.fault_photos;
create policy "fault_photos_select_active_users"
on public.fault_photos for select
to authenticated
using (public.is_active_user());

drop policy if exists "fault_photos_insert_ops" on public.fault_photos;
create policy "fault_photos_insert_ops"
on public.fault_photos for insert
to authenticated
with check (public.is_operations_staff());

drop policy if exists "weekly_reports_select_active_users" on public.weekly_reports;
create policy "weekly_reports_select_active_users"
on public.weekly_reports for select
to authenticated
using (public.is_admin() or (public.is_active_user() and is_archived = false));

drop policy if exists "weekly_reports_insert_ops" on public.weekly_reports;
create policy "weekly_reports_insert_ops"
on public.weekly_reports for insert
to authenticated
with check (public.is_operations_staff());

drop policy if exists "weekly_reports_update_ops" on public.weekly_reports;
create policy "weekly_reports_update_ops"
on public.weekly_reports for update
to authenticated
using (public.is_operations_staff())
with check (public.is_operations_staff());

drop policy if exists "troubleshooting_guides_select_active_users" on public.troubleshooting_guides;
create policy "troubleshooting_guides_select_active_users"
on public.troubleshooting_guides for select
to authenticated
using (public.is_admin() or (public.is_active_user() and active = true));

drop policy if exists "troubleshooting_guides_insert_ops" on public.troubleshooting_guides;
create policy "troubleshooting_guides_insert_ops"
on public.troubleshooting_guides for insert
to authenticated
with check (public.is_operations_staff());

drop policy if exists "troubleshooting_guides_update_ops" on public.troubleshooting_guides;
create policy "troubleshooting_guides_update_ops"
on public.troubleshooting_guides for update
to authenticated
using (public.is_operations_staff())
with check (public.is_operations_staff());

drop policy if exists "activity_log_select_active_users" on public.activity_log;
create policy "activity_log_select_active_users"
on public.activity_log for select
to authenticated
using (public.is_active_user());

-- No insert/update/delete policies are created for public.activity_log.
-- Trusted server-side code should call public.create_activity_log().

-- ==================================================
-- Storage Buckets
-- ==================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('site-images', 'site-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('charger-images', 'charger-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('charger-documents', 'charger-documents', false, 20971520, array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv']),
  ('site-visit-reports', 'site-visit-reports', false, 20971520, array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv']),
  ('fault-photos', 'fault-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('weekly-reports', 'weekly-reports', false, 20971520, array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv']),
  ('troubleshooting-guides', 'troubleshooting-guides', false, 20971520, array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Use signed URLs in the frontend for previews and downloads. Recommended object path pattern:
-- {bucket}/{site_id}/{record_or_charger_id}/{auth.uid()}-{timestamp}-{safe_file_name}

-- ==================================================
-- Storage Policies
-- ==================================================

drop policy if exists "storage_select_active_users" on storage.objects;
create policy "storage_select_active_users"
on storage.objects for select
to authenticated
using (
  bucket_id in ('site-images', 'charger-images', 'charger-documents', 'site-visit-reports', 'fault-photos', 'weekly-reports', 'troubleshooting-guides')
  and public.is_active_user()
);

drop policy if exists "storage_insert_ops" on storage.objects;
create policy "storage_insert_ops"
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('site-images', 'charger-images', 'charger-documents', 'site-visit-reports', 'fault-photos', 'weekly-reports', 'troubleshooting-guides')
  and public.is_operations_staff()
  and position(auth.uid()::text in name) > 0
);

-- No browser overwrite or delete policy is created for storage.objects in V1.

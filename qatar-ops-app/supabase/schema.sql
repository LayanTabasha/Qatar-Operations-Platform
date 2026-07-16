-- Zeeda Energy Qatar Operations Platform
-- Supabase PostgreSQL schema for the production backend.
-- Run this in the Supabase SQL editor after creating a Supabase project.

create extension if not exists pgcrypto;

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

insert into roles (name, description)
values
  ('Administrator', 'Full system access'),
  ('Operations Staff', 'Operational record access without user or role management'),
  ('Viewer', 'Read-only access')
on conflict (name) do nothing;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role_id uuid not null references roles(id),
  account_status text not null default 'Active' check (account_status in ('Invited', 'Active', 'Disabled', 'Locked')),
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  last_login_at timestamptz
);

create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text,
  location text,
  status text not null default 'Pending Data',
  client_organization text,
  description text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chargers (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete restrict,
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
  image_url text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists site_visits (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete restrict,
  charger_id uuid not null references chargers(id) on delete restrict,
  visit_date date,
  time_in time,
  time_out time,
  purpose text,
  notes text,
  report_file_url text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists faults (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete restrict,
  charger_id uuid not null references chargers(id) on delete restrict,
  category text,
  error_code text,
  priority text,
  status text not null default 'Open',
  description text,
  assigned_engineer text,
  comments text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete restrict,
  charger_id uuid references chargers(id) on delete restrict,
  type text,
  name text not null,
  file_url text not null,
  notes text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  version integer not null default 1
);

create table if not exists weekly_reports (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete restrict,
  charger_id uuid not null references chargers(id) on delete restrict,
  week_number text,
  date_range text,
  summary text,
  file_url text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  version integer not null default 1
);

create table if not exists troubleshooting_guides (
  id uuid primary key default gen_random_uuid(),
  charger_id uuid not null references chargers(id) on delete restrict,
  title text not null,
  charger_type text,
  fault_category text,
  error_code text,
  symptoms text,
  possible_causes text,
  tools_required text,
  step_by_step_fix text,
  related_documents jsonb not null default '[]'::jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references roles(id) on delete cascade,
  resource text not null,
  action text not null,
  allowed boolean not null default false,
  unique (role_id, resource, action)
);

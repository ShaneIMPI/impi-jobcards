-- ============================================================
-- IMPI Job Card System — Database Schema
-- Run this once in your Supabase project's SQL Editor
-- (Dashboard → SQL Editor → New Query → paste all of this → Run)
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILES
-- Extends Supabase's built-in auth.users with role + display info.
-- A row is created automatically here whenever someone signs up
-- via magic link for the first time (see trigger below).
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default 'Unnamed Staff',
  role text not null default 'staff' check (role in ('admin', 'hr', 'staff')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row the first time someone logs in.
-- New staff always start as role='staff' — you upgrade to 'admin'
-- or 'hr' manually afterwards (see README, Step 4).
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ------------------------------------------------------------
-- 2. SITES
-- The dropdown list of known sites. Admin manages this list.
-- Staff can still type a one-off site name if it's not listed.
-- ------------------------------------------------------------
create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. JOB ENTRIES
-- One row per site visit (sign-in to sign-out). A staff member
-- can have several of these in one day if they travel between sites.
-- ------------------------------------------------------------
create table if not exists job_entries (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles(id) on delete cascade,
  site_id uuid references sites(id),
  site_name_other text,                     -- used if site wasn't in the dropdown
  sign_in_at timestamptz not null default now(),
  sign_in_offline boolean not null default false,   -- true if timestamp came from device, not server
  sign_out_at timestamptz,
  sign_out_offline boolean not null default false,
  notes text,
  closed_manually boolean not null default false,   -- true if staff/admin force-closed a forgotten sign-out
  close_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_specified check (site_id is not null or site_name_other is not null)
);

create index if not exists idx_job_entries_staff on job_entries(staff_id);
create index if not exists idx_job_entries_sign_in on job_entries(sign_in_at);

-- Keep updated_at current on every edit
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_job_entries_updated on job_entries;
create trigger trg_job_entries_updated
  before update on job_entries
  for each row execute procedure set_updated_at();

-- ------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ------------------------------------------------------------
alter table profiles enable row level security;
alter table sites enable row level security;
alter table job_entries enable row level security;

-- Helper: is the current user an admin or HR?
create or replace function is_admin()
returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$ language sql security definer stable;

create or replace function is_hr_or_admin()
returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'hr'));
$$ language sql security definer stable;

-- PROFILES policies
create policy "profiles_select_own_or_hr_admin" on profiles
  for select using (id = auth.uid() or is_hr_or_admin());

create policy "profiles_update_own_name" on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_admin_full_update" on profiles
  for update using (is_admin());

-- SITES policies
create policy "sites_select_active_all_authenticated" on sites
  for select using (auth.role() = 'authenticated');

create policy "sites_admin_manage" on sites
  for all using (is_admin()) with check (is_admin());

-- JOB_ENTRIES policies
create policy "job_entries_select_own_or_hr_admin" on job_entries
  for select using (staff_id = auth.uid() or is_hr_or_admin());

create policy "job_entries_insert_own" on job_entries
  for insert with check (staff_id = auth.uid());

create policy "job_entries_update_own_or_admin" on job_entries
  for update using (staff_id = auth.uid() or is_admin());

-- ============================================================
-- SETUP NOTES
-- 1. After running this, go to Authentication → Providers → Email
--    and make sure "Enable Email provider" is ON and confirm
--    "Confirm email" matches your preference (magic link works
--    either way, but simplest is to leave email confirmations off
--    for magic-link-only flows).
-- 2. Go to Authentication → URL Configuration and set your Site URL
--    and Redirect URLs to your deployed app's GitHub Pages URL
--    once you have it (Step 6 in README).
-- 3. Add your staff's sites into the `sites` table (SQL editor or
--    Table Editor UI) — e.g. Menlyn Park Shopping Centre, Nasonti /
--    Goedehoop Mine, etc.
-- 4. Once you (Shane) log in for the first time, run:
--      update profiles set role = 'admin' where email = 'YOUR_EMAIL_HERE';
--    to promote yourself. Do the same with role = 'hr' for HR staff.
-- ============================================================

-- Migration: 001_initial_schema (Safe version)
-- Description: Create initial tables for roles and profiles
-- This version is safe to run multiple times (idempotent)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create roles table (only if it doesn't exist)
do $$
begin
  if not exists (select from pg_tables where schemaname = 'public' and tablename = 'roles') then
    create table public.roles (
      id uuid default gen_random_uuid() primary key,
      name text unique not null,
      description text,
      permissions jsonb not null default '[]'::jsonb,
      is_fixed boolean default false,
      created_at timestamp with time zone default timezone('utc'::text, now()) not null
    );
  end if;
end $$;

-- Enable RLS on roles table
alter table public.roles enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Anyone can view roles" on public.roles;
drop policy if exists "Only admins can modify roles" on public.roles;

-- RLS policies for roles
create policy "Anyone can view roles"
  on public.roles for select
  to authenticated
  using (true);

create policy "Only admins can modify roles"
  on public.roles for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      join public.roles r on p.role_id = r.id
      where p.id = auth.uid()
      and r.permissions @> '["all"]'::jsonb
    )
  );

-- Insert fixed roles (only if they don't exist)
insert into public.roles (name, description, is_fixed, permissions)
select 'Admin', 'Full system access', true, '["all"]'::jsonb
where not exists (select 1 from public.roles where name = 'Admin');

insert into public.roles (name, description, is_fixed, permissions)
select 'Manager', 'Team and inventory management', true, '["inventory:read", "inventory:write", "tasks:manage", "orders:manage", "reports:view"]'::jsonb
where not exists (select 1 from public.roles where name = 'Manager');

insert into public.roles (name, description, is_fixed, permissions)
select 'Staff', 'Basic operations', true, '["inventory:read", "tasks:view", "tasks:update"]'::jsonb
where not exists (select 1 from public.roles where name = 'Staff');

-- Create profiles table (only if it doesn't exist)
do $$
begin
  if not exists (select from pg_tables where schemaname = 'public' and tablename = 'profiles') then
    create table public.profiles (
      id uuid references auth.users on delete cascade primary key,
      email text unique not null,
      full_name text,
      role_id uuid references public.roles(id),
      location_id uuid, -- will reference locations table (to be created in next migration)
      preferences jsonb default '{}'::jsonb,
      created_at timestamp with time zone default timezone('utc'::text, now()) not null,
      updated_at timestamp with time zone default timezone('utc'::text, now()) not null
    );
  end if;
end $$;

-- Enable RLS on profiles table
alter table public.profiles enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Admins can update all profiles" on public.profiles;

-- RLS policies for profiles
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      join public.roles r on p.role_id = r.id
      where p.id = auth.uid()
      and r.permissions @> '["all"]'::jsonb
    )
  );

create policy "Admins can update all profiles"
  on public.profiles for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      join public.roles r on p.role_id = r.id
      where p.id = auth.uid()
      and r.permissions @> '["all"]'::jsonb
    )
  );

-- Drop existing trigger and function if they exist
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- Function to automatically create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Drop existing trigger and function for updated_at if they exist
drop trigger if exists on_profiles_updated on public.profiles;
drop function if exists public.handle_updated_at();

-- Function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to update updated_at on profiles
create trigger on_profiles_updated
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- Create indexes for better performance (only if they don't exist)
create index if not exists profiles_role_id_idx on public.profiles(role_id);
create index if not exists profiles_email_idx on public.profiles(email);

-- Migration: 002_fix_rls_recursion
-- Description: Fix infinite recursion in RLS policies by using security definer functions
-- This also ensures basic user policies exist correctly

-- Drop ALL existing policies to start fresh
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Admins can update all profiles" on public.profiles;
drop policy if exists "Admins can insert profiles" on public.profiles;
drop policy if exists "Admins can delete profiles" on public.profiles;
drop policy if exists "Anyone can view roles" on public.roles;
drop policy if exists "Only admins can modify roles" on public.roles;

-- Create security definer function to check if user is admin
-- This function runs with the privileges of the function owner, bypassing RLS
create or replace function public.is_admin(user_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles p
    join public.roles r on p.role_id = r.id
    where p.id = user_id
    and r.permissions @> '["all"]'::jsonb
  );
end;
$$ language plpgsql security definer;

-- Create security definer function to check if user has specific permission
create or replace function public.has_permission(user_id uuid, permission text)
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles p
    join public.roles r on p.role_id = r.id
    where p.id = user_id
    and (
      r.permissions @> '["all"]'::jsonb
      or r.permissions @> jsonb_build_array(permission)
    )
  );
end;
$$ language plpgsql security definer;

-- Grant execute permissions
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.has_permission(uuid, text) to authenticated;

-- PROFILES TABLE POLICIES
-- Basic user policies (CRITICAL!)
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Admin policies using security definer functions
create policy "Admins can view all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy "Admins can update all profiles"
  on public.profiles for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "Admins can insert profiles"
  on public.profiles for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy "Admins can delete profiles"
  on public.profiles for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- ROLES TABLE POLICIES
create policy "Anyone can view roles"
  on public.roles for select
  to authenticated
  using (true);

create policy "Only admins can modify roles"
  on public.roles for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

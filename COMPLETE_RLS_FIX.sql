-- Complete RLS Fix: Ensure all policies exist correctly
-- Run this in Supabase SQL Editor

-- First, drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view roles" ON public.roles;
DROP POLICY IF EXISTS "Only admins can modify roles" ON public.roles;

-- Create security definer functions (if they don't exist)
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = user_id
    AND r.permissions @> '["all"]'::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_permission(user_id uuid, permission text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = user_id
    AND (
      r.permissions @> '["all"]'::jsonb
      OR r.permissions @> jsonb_build_array(permission)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;

-- PROFILES TABLE POLICIES
-- Basic user policies (these are critical!)
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin policies
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ROLES TABLE POLICIES
CREATE POLICY "Anyone can view roles"
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can modify roles"
  ON public.roles FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Verify policies were created
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd as command
FROM pg_policies
WHERE tablename IN ('profiles', 'roles')
ORDER BY tablename, policyname;

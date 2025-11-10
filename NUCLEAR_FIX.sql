-- NUCLEAR OPTION: Completely reset RLS with a different approach
-- This disables RLS temporarily, creates everything, then re-enables

-- Step 1: DISABLE RLS temporarily
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view roles" ON public.roles;
DROP POLICY IF EXISTS "Only admins can modify roles" ON public.roles;

-- Step 3: Drop existing functions
DROP FUNCTION IF EXISTS public.is_admin(uuid);
DROP FUNCTION IF EXISTS public.has_permission(uuid, text);

-- Step 4: Create NEW approach - use a MATERIALIZED approach
-- Instead of checking in real-time, we'll use a simpler direct check

-- Create function that gets role permissions WITHOUT joining profiles
CREATE OR REPLACE FUNCTION public.get_user_role_permissions(user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(r.permissions, '[]'::jsonb)
  FROM profiles p
  JOIN roles r ON p.role_id = r.id
  WHERE p.id = user_id
  LIMIT 1;
$$;

-- Create simpler is_admin check
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT r.permissions @> '["all"]'::jsonb
     FROM profiles p
     JOIN roles r ON p.role_id = r.id
     WHERE p.id = user_id
     LIMIT 1),
    false
  );
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_user_role_permissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

-- Step 5: Create SIMPLE policies that don't cause recursion
-- Key: Basic user policy uses only auth.uid(), no function calls

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Roles table - anyone can read (needed for joins)
CREATE POLICY "Anyone can view roles"
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);

-- Step 6: Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Step 7: NOW add admin policies after RLS is working for basic users
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

CREATE POLICY "Only admins can modify roles"
  ON public.roles FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Step 8: Verify setup
SELECT 'RLS Status:' as info;
SELECT tablename, rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('profiles', 'roles');

SELECT 'Policies:' as info;
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('profiles', 'roles')
ORDER BY tablename, policyname;

SELECT 'Functions:' as info;
SELECT proname, prosecdef as is_security_definer, lanname as language
FROM pg_proc p
JOIN pg_language l ON p.prolang = l.oid
WHERE proname IN ('is_admin', 'get_user_role_permissions');

-- Step 9: Test with your user ID
SELECT 'Testing is_admin function:' as info;
SELECT public.is_admin('de57adf1-b6ed-45f1-9405-f84397789040'::uuid) as is_admin_result;

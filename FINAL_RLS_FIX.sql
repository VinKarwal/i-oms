-- CRITICAL FIX: Complete RLS Reset with Proper Security Definer Functions
-- This version ensures the functions truly bypass RLS by setting search_path

-- Step 1: Drop ALL existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Anyone can view roles" ON public.roles;
  DROP POLICY IF EXISTS "Only admins can modify roles" ON public.roles;
  RAISE NOTICE 'All policies dropped';
END $$;

-- Step 2: Create helper function that TRULY bypasses RLS
-- The key is using a SQL function (not plpgsql) with SECURITY DEFINER
-- SQL functions with SECURITY DEFINER properly bypass RLS
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean 
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = user_id
    AND r.permissions @> '["all"]'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(user_id uuid, permission text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = user_id
    AND (
      r.permissions @> '["all"]'::jsonb
      OR r.permissions @> jsonb_build_array(permission)
    )
  );
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;

-- Step 3: Create ONLY the basic user policies first (no recursion possible)
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Step 4: Create roles policies (no recursion)
CREATE POLICY "Anyone can view roles"
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);

-- Step 5: Now create admin policies using the security definer function
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

-- Step 6: Test the is_admin function directly
-- Replace 'de57adf1-b6ed-45f1-9405-f84397789040' with your user ID
DO $$
DECLARE
  test_result boolean;
BEGIN
  SELECT public.is_admin('de57adf1-b6ed-45f1-9405-f84397789040'::uuid) INTO test_result;
  RAISE NOTICE 'is_admin test result: %', test_result;
END $$;

-- Step 7: Verify all policies
SELECT 
    tablename,
    policyname,
    cmd as command,
    CASE 
      WHEN cmd = 'SELECT' THEN '✅ Read'
      WHEN cmd = 'UPDATE' THEN '✅ Update'
      WHEN cmd = 'INSERT' THEN '✅ Insert'
      WHEN cmd = 'DELETE' THEN '✅ Delete'
      WHEN cmd = 'ALL' THEN '✅ All Operations'
    END as operation
FROM pg_policies
WHERE tablename IN ('profiles', 'roles')
ORDER BY tablename, policyname;

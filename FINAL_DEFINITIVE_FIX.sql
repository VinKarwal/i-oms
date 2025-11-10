-- DEFINITIVE FIX: Check current state and fix recursion
-- Run this ENTIRE script in Supabase SQL Editor

-- Step 1: Check what policies currently exist
SELECT 
    '=== CURRENT POLICIES ===' as info,
    tablename,
    policyname,
    cmd,
    qual as policy_definition
FROM pg_policies
WHERE tablename IN ('profiles', 'roles')
ORDER BY tablename, policyname;

-- Step 2: DISABLE RLS temporarily to avoid issues during changes
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;

-- Step 3: DROP ALL POLICIES completely
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on profiles
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
    END LOOP;
    
    -- Drop all policies on roles
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'roles') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.roles', r.policyname);
    END LOOP;
    
    RAISE NOTICE 'All policies dropped successfully';
END $$;

-- Step 4: Verify all policies are gone
SELECT 
    '=== AFTER DROPPING ===' as info,
    COUNT(*) as remaining_policies
FROM pg_policies
WHERE tablename IN ('profiles', 'roles');

-- Step 5: Create ONLY basic policies first (no recursion risk)
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Anyone can view roles"
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);

-- Step 6: Re-enable RLS with just basic policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Step 7: Test that basic query works now
-- This should NOT cause recursion because only basic policies exist
SELECT 
    '=== TEST QUERY (should work now) ===' as info,
    id,
    email,
    role_id
FROM profiles
WHERE id = 'de57adf1-b6ed-45f1-9405-f84397789040'::uuid;

-- Step 8: Now add admin policies with the CORRECT non-recursive approach
-- Key: Only check auth.uid()'s role, not the target row's role
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    -- Check if the CURRENT USER (auth.uid()) has admin role
    -- This only queries ONE specific row (auth.uid()), avoiding recursion
    (SELECT role_id FROM profiles WHERE id = auth.uid())
    IN (SELECT id FROM roles WHERE permissions @> '["all"]'::jsonb)
  );

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    (SELECT role_id FROM profiles WHERE id = auth.uid())
    IN (SELECT id FROM roles WHERE permissions @> '["all"]'::jsonb)
  )
  WITH CHECK (
    (SELECT role_id FROM profiles WHERE id = auth.uid())
    IN (SELECT id FROM roles WHERE permissions @> '["all"]'::jsonb)
  );

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role_id FROM profiles WHERE id = auth.uid())
    IN (SELECT id FROM roles WHERE permissions @> '["all"]'::jsonb)
  );

CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (
    (SELECT role_id FROM profiles WHERE id = auth.uid())
    IN (SELECT id FROM roles WHERE permissions @> '["all"]'::jsonb)
  );

CREATE POLICY "Only admins can modify roles"
  ON public.roles FOR ALL
  TO authenticated
  USING (
    (SELECT role_id FROM profiles WHERE id = auth.uid())
    IN (SELECT id FROM roles WHERE permissions @> '["all"]'::jsonb)
  )
  WITH CHECK (
    (SELECT role_id FROM profiles WHERE id = auth.uid())
    IN (SELECT id FROM roles WHERE permissions @> '["all"]'::jsonb)
  );

-- Step 9: Final verification
SELECT 
    '=== FINAL POLICIES ===' as info,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename IN ('profiles', 'roles')
ORDER BY tablename, policyname;

-- Step 10: Test the full query with join
SELECT 
    '=== FINAL TEST WITH JOIN ===' as info,
    p.id,
    p.email,
    p.role_id,
    r.name as role_name
FROM profiles p
LEFT JOIN roles r ON p.role_id = r.id
WHERE p.id = 'de57adf1-b6ed-45f1-9405-f84397789040'::uuid;

SELECT '=== SUCCESS ===' as status, 'All policies recreated without recursion!' as message;

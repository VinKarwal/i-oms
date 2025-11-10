# Complete RLS Fix: Run This in Supabase SQL Editor

**Dashboard**: https://supabase.com/dashboard → Your Project → SQL Editor → New Query

Copy and paste this entire SQL script, then click **Run**:

```sql
-- Complete RLS Fix: Ensure all policies exist correctly
-- This fixes both infinite recursion AND missing basic user policies

-- Step 1: Drop ALL existing policies to start fresh
DO $$ 
BEGIN
  -- Drop all policies on profiles table
  DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
  
  -- Drop all policies on roles table
  DROP POLICY IF EXISTS "Anyone can view roles" ON public.roles;
  DROP POLICY IF EXISTS "Only admins can modify roles" ON public.roles;
  
  RAISE NOTICE 'All existing policies dropped successfully';
END $$;

-- Create security definer function to check if user is admin
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

-- Create security definer function to check if user has specific permission
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

-- Step 2: Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;

-- Step 3: Create all policies fresh

-- PROFILES TABLE POLICIES
-- Basic user policies (CRITICAL - allows users to view their own profile!)
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin policies using security definer functions
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

-- Step 4: Verify policies were created correctly
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
      ELSE cmd
    END as operation
FROM pg_policies
WHERE tablename IN ('profiles', 'roles')
ORDER BY tablename, policyname;
```

## Expected Result
You should see a table with 10 policies:

**Profiles table (8 policies)**:
- Admins can delete profiles (DELETE)
- Admins can insert profiles (INSERT)
- Admins can update all profiles (UPDATE)
- Admins can view all profiles (SELECT)
- Users can update own profile (UPDATE)
- Users can view own profile (SELECT)

**Roles table (2 policies)**:
- Anyone can view roles (SELECT)
- Only admins can modify roles (ALL)

## After Running
1. ✅ Scroll down to verify you see the 10 policies listed
2. ✅ Close SQL Editor
3. ✅ Go back to your app at `http://localhost:3000`
4. ✅ Open browser console (F12)
5. ✅ Click "Check Status" button
6. ✅ Check console for detailed logs
7. ✅ Should redirect to admin dashboard without errors!

---

**What this fixes**: 
1. ✅ Infinite recursion error (using security definer functions)
2. ✅ Empty error object when querying profile (adds "Users can view own profile" policy)
3. ✅ Ensures all RLS policies are correctly configured

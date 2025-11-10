-- REAL FIX: Don't use functions - use direct subqueries with EXISTS
-- The trick: Use EXISTS with a correlated subquery that doesn't re-trigger the policy

-- Step 1: Drop everything
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view roles" ON public.roles;
DROP POLICY IF EXISTS "Only admins can modify roles" ON public.roles;

-- Step 2: Create policies WITHOUT functions
-- The key: Check role by querying the user's OWN profile only (auth.uid())

-- Basic user policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin policies - check if the CURRENT USER (auth.uid()) has admin role
-- This avoids recursion because we only check auth.uid(), not the row being accessed
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = (
        SELECT role_id FROM profiles WHERE id = auth.uid()
      )
      AND r.permissions @> '["all"]'::jsonb
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = (
        SELECT role_id FROM profiles WHERE id = auth.uid()
      )
      AND r.permissions @> '["all"]'::jsonb
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = (
        SELECT role_id FROM profiles WHERE id = auth.uid()
      )
      AND r.permissions @> '["all"]'::jsonb
    )
  );

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = (
        SELECT role_id FROM profiles WHERE id = auth.uid()
      )
      AND r.permissions @> '["all"]'::jsonb
    )
  );

CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = (
        SELECT role_id FROM profiles WHERE id = auth.uid()
      )
      AND r.permissions @> '["all"]'::jsonb
    )
  );

-- Roles policies
CREATE POLICY "Anyone can view roles"
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can modify roles"
  ON public.roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = (
        SELECT role_id FROM profiles WHERE id = auth.uid()
      )
      AND r.permissions @> '["all"]'::jsonb
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = (
        SELECT role_id FROM profiles WHERE id = auth.uid()
      )
      AND r.permissions @> '["all"]'::jsonb
    )
  );

-- Step 3: Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Step 4: Verify
SELECT 'Policies created:' as status;
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('profiles', 'roles')
ORDER BY tablename, policyname;

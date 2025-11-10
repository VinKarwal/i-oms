-- TEMPORARY FIX: Remove admin policies to test if they're causing recursion
-- This will help us confirm which policy is the problem

-- Drop admin policies temporarily
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can modify roles" ON public.roles;

-- Show remaining policies (should only be basic user policies)
SELECT 
    '=== REMAINING POLICIES ===' as info,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename IN ('profiles', 'roles')
ORDER BY tablename, policyname;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';
COMMENT ON TABLE public.profiles IS 'Profiles - admin policies removed for testing';

SELECT 'Now test your app - the Check Status button should work!' as next_step;

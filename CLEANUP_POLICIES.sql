-- Clean up duplicate/old policies

-- Drop old duplicate policies
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "All authenticated users can view roles" ON public.roles;
DROP POLICY IF EXISTS "Only admins can manage roles" ON public.roles;

-- Verify only the correct policies remain
SELECT 
    tablename,
    policyname,
    cmd as command
FROM pg_policies
WHERE tablename IN ('profiles', 'roles')
ORDER BY tablename, policyname;

-- Should now show only 10 policies:
-- profiles: 6 policies (Users view/update, Admins view/update/insert/delete)
-- roles: 2 policies (Anyone can view, Only admins can modify)

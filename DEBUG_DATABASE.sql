-- DEBUG: Let's first check what's actually happening in the database

-- 1. Check current policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename IN ('profiles', 'roles')
ORDER BY tablename, policyname;

-- 2. Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename IN ('profiles', 'roles');

-- 3. Check if functions exist and their properties
SELECT 
    p.proname as function_name,
    p.prosecdef as is_security_definer,
    l.lanname as language,
    p.provolatile as volatility,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname = 'public'
AND p.proname IN ('is_admin', 'has_permission');

-- 4. Test your profile query as superuser (bypasses RLS)
SELECT 
    p.id,
    p.email,
    p.role_id,
    r.id as role_id_from_roles,
    r.name as role_name,
    r.permissions
FROM profiles p
LEFT JOIN roles r ON p.role_id = r.id
WHERE p.id = 'de57adf1-b6ed-45f1-9405-f84397789040'::uuid;

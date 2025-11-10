-- DIAGNOSIS: Let's find the EXACT cause of recursion

-- 1. Show the EXACT policy definitions (the full USING clause)
SELECT 
    '=== POLICY DEFINITIONS ===' as section,
    schemaname,
    tablename,
    policyname,
    cmd,
    pg_get_expr(polqual, polrelid) as using_expression,
    pg_get_expr(polwithcheck, polrelid) as with_check_expression
FROM pg_policies p
JOIN pg_policy pol ON (
    pol.polname = p.policyname 
    AND pol.polrelid = (p.schemaname || '.' || p.tablename)::regclass
)
WHERE tablename IN ('profiles', 'roles')
ORDER BY tablename, policyname;

-- 2. Check if there are any functions still being used
SELECT 
    '=== FUNCTIONS ===' as section,
    proname,
    prosecdef as is_security_definer,
    pg_get_functiondef(oid) as full_definition
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
AND proname IN ('is_admin', 'has_permission');

-- 3. Test the exact query the app is making
-- This will tell us which policy is causing the recursion
SET ROLE authenticated;
SET request.jwt.claim.sub = 'de57adf1-b6ed-45f1-9405-f84397789040';

-- Try the query
SELECT 
    '=== TESTING APP QUERY ===' as section,
    id,
    email,
    role_id
FROM profiles
WHERE id = 'de57adf1-b6ed-45f1-9405-f84397789040'::uuid;

-- Try with join
SELECT 
    '=== TESTING WITH JOIN ===' as section,
    p.id,
    p.email,
    p.role_id,
    r.id as role_table_id,
    r.name as role_name
FROM profiles p
LEFT JOIN roles r ON p.role_id = r.id
WHERE p.id = 'de57adf1-b6ed-45f1-9405-f84397789040'::uuid;

RESET ROLE;

-- 4. Check if the query with explicit columns works
SELECT 
    '=== TESTING EXACT APP QUERY ===' as section;
    
SET ROLE authenticated;
SET request.jwt.claim.sub = 'de57adf1-b6ed-45f1-9405-f84397789040';

SELECT id, email, role_id
FROM profiles
WHERE id = 'de57adf1-b6ed-45f1-9405-f84397789040'::uuid;

RESET ROLE;

# Debug: Check RLS Policies and User Session

Run these queries in **Supabase SQL Editor** to diagnose the issue:

## 1. Check Current RLS Policies on Profiles

```sql
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
```

## 2. Check if Functions Exist

```sql
SELECT 
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('is_admin', 'has_permission')
ORDER BY routine_name;
```

## 3. Test the is_admin Function with Your User ID

```sql
-- Replace 'de57adf1-b6ed-45f1-9405-f84397789040' with your actual user ID
SELECT public.is_admin('de57adf1-b6ed-45f1-9405-f84397789040'::uuid) as is_admin;
```

## 4. Check Your Profile Directly (as superuser - this bypasses RLS)

```sql
-- This query runs as superuser and bypasses RLS
SELECT 
    p.id,
    p.email,
    p.full_name,
    p.role_id,
    r.name as role_name,
    r.permissions
FROM profiles p
LEFT JOIN roles r ON p.role_id = r.id
WHERE p.email = 'vinaypratakarwal@gmail.com';
```

## 5. Test RLS Policy Directly

```sql
-- This simulates what the client sees
SET ROLE authenticated;
SET request.jwt.claim.sub = 'de57adf1-b6ed-45f1-9405-f84397789040'; -- Your user ID

SELECT 
    id,
    email,
    role_id
FROM profiles
WHERE id = 'de57adf1-b6ed-45f1-9405-f84397789040'::uuid;

-- Reset
RESET ROLE;
```

## Expected Issues

### Issue 1: "Users can view own profile" policy might be missing
If you only see admin policies, the basic user policy is missing.

**Fix**:
```sql
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
```

### Issue 2: Migration didn't run completely
Check if you see these policies:
- ✅ Users can view own profile
- ✅ Users can update own profile  
- ✅ Admins can view all profiles
- ✅ Admins can update all profiles
- ✅ Admins can insert profiles
- ✅ Admins can delete profiles

If missing, re-run the migration.

### Issue 3: Functions not created as SECURITY DEFINER
Check if functions show `security_type = 'DEFINER'` in query #2.

---

**Run these queries and share the results so I can help diagnose the exact issue!**

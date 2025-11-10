# RLS Infinite Recursion Fix

## Problem
**Error**: `infinite recursion detected in policy for relation "profiles"`  
**Code**: PostgreSQL 42P17

## Root Cause
The RLS policies for checking admin privileges were creating a circular dependency:

1. User tries to query `profiles` table
2. RLS policy checks if user is admin by querying `profiles` table
3. Step 2 triggers the same RLS policy again
4. **Infinite recursion** occurs

### Problematic Policy
```sql
create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p  -- ❌ This queries profiles while checking profiles!
      join public.roles r on p.role_id = r.id
      where p.id = auth.uid()
      and r.permissions @> '["all"]'::jsonb
    )
  );
```

## Solution
Use **security definer functions** that bypass RLS when checking permissions:

```sql
create or replace function public.is_admin(user_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles p
    join public.roles r on p.role_id = r.id
    where p.id = user_id
    and r.permissions @> '["all"]'::jsonb
  );
end;
$$ language plpgsql security definer;  -- ✅ security definer bypasses RLS
```

Then use the function in policies:
```sql
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin(auth.uid()));  -- ✅ No recursion!
```

## How to Apply Fix

### Option 1: Run Migration in Supabase Dashboard (Recommended)

1. Open your Supabase dashboard: https://supabase.com/dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy the contents of `supabase/migrations/002_fix_rls_recursion.sql`
5. Paste and click **Run**
6. You should see "Success. No rows returned"

### Option 2: Run via Supabase CLI

```powershell
# If you have Supabase CLI installed
supabase db push
```

## Migration File
**Location**: `supabase/migrations/002_fix_rls_recursion.sql`

**What it does**:
1. ✅ Drops problematic RLS policies
2. ✅ Creates `is_admin()` security definer function
3. ✅ Creates `has_permission()` security definer function
4. ✅ Recreates RLS policies using the new functions
5. ✅ Adds INSERT and DELETE policies for admins
6. ✅ Grants execute permissions to authenticated users

## Testing After Migration

### 1. Verify Migration Success
In Supabase SQL Editor, run:
```sql
-- Check if functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('is_admin', 'has_permission');

-- Should return 2 rows
```

### 2. Test the Functions
```sql
-- Replace with your actual user ID
SELECT public.is_admin('de57adf1-b6ed-45f1-9405-f84397789040'::uuid);

-- Should return: true (if user is admin) or false
```

### 3. Test Profile Query
In your browser console or app:
```javascript
const { data, error } = await supabase
  .from('profiles')
  .select('id, email, role_id, roles(id, name)')
  .eq('id', 'your-user-id')
  .single()

console.log(data, error)
// Should return profile data without recursion error
```

### 4. Test in App
1. Refresh your browser at `http://localhost:3000`
2. Click **"Check Status"** button on pending page
3. Should redirect to admin dashboard without errors
4. Navigate to **Admin → Users**
5. User list should load successfully

## What This Fixes

- ✅ Pending page "Check Status" button
- ✅ Admin dashboard loading
- ✅ User management page
- ✅ All profile queries with role joins
- ✅ Admin privilege checks across the app

## Security Notes

**Security Definer Functions**:
- Run with the privileges of the function owner (superuser)
- Bypass RLS policies
- Should ONLY be used for authentication/authorization checks
- Never expose sensitive data directly through these functions

**Why It's Safe**:
- Functions only return boolean values (true/false)
- Functions still check actual permissions in database
- RLS policies still protect data access
- Only the permission check bypasses RLS, not the actual data query

## Prevention

When creating RLS policies:
1. ❌ Never query the same table you're protecting in the policy
2. ✅ Use security definer functions for permission checks
3. ✅ Keep authorization logic separate from data access
4. ✅ Test policies with different user roles

## Next Steps

1. **Run the migration** in Supabase dashboard
2. **Refresh your browser** at localhost:3000
3. **Test the "Check Status"** button
4. **Verify admin dashboard** loads correctly
5. **Check user management** page works

---

**Status**: Migration created and ready to run. Apply it in Supabase dashboard to fix the infinite recursion error.

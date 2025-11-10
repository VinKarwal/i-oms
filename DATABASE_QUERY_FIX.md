# Database Query Fix - PostgreSQL 42P17 Error

## Issue
Users were encountering HTTP 500 errors with PostgreSQL error code **42P17** (ambiguous column reference) when querying profiles with roles.

## Root Cause
The queries were using wildcard selects with table joins:
```typescript
.select('*, roles(*)')
```

This caused PostgreSQL to be unable to determine which table columns like `id`, `name`, etc. belonged to when both tables had columns with the same names.

## Solution
Changed all queries to use **explicit column selection**:

```typescript
// Before (ERROR)
.select('*, roles(*)')

// After (FIXED)
.select('id, email, full_name, role_id, created_at, updated_at, roles(id, name)')
```

## Files Fixed

### 1. `app/pending/pending-client.tsx`
- Fixed "Check Status" button query
- Added array handling for roles response
```typescript
const { data: profile, error } = await supabase
  .from('profiles')
  .select('id, email, role_id, roles(id, name)')
  .eq('id', user.id)
  .single()

const roles = Array.isArray(profile.roles) ? profile.roles[0] : profile.roles
```

### 2. `app/pending/page.tsx`
- Fixed server-side role check query
- Added array handling for roles

### 3. `app/admin/page.tsx`
- Fixed profile fetch with explicit columns
- Updated role extraction logic

### 4. `app/admin/users/page.tsx`
- Fixed both user profile query and users list query
- Ensured all necessary columns are selected

### 5. `app/admin/users/user-management-client.tsx`
- Updated Profile type to handle both object and array responses
- Fixed role name display with array handling

### 6. `app/manager/page.tsx`
- Fixed profile fetch query
- Updated role handling

### 7. `app/staff/page.tsx`
- Fixed profile fetch query
- Updated role handling

## TypeScript Type Updates

Updated the Profile type to handle Supabase's flexible response format:

```typescript
type Profile = {
  id: string
  email: string
  full_name: string | null
  role_id: string | null
  created_at: string
  updated_at: string
  roles: { id: string; name: string } | { id: string; name: string }[] | null
}
```

## Testing Required

Please test the following flows:

1. ✅ **Pending Page**
   - Click "Check Status" button
   - Should fetch role without errors
   - Should redirect to appropriate dashboard if role is assigned

2. ✅ **Admin Dashboard**
   - Should load without errors
   - Stats should display correctly

3. ✅ **User Management**
   - Users list should display with role badges
   - Role assignment should work
   - Search functionality should work

4. ✅ **Manager Dashboard**
   - Should load without errors
   - Role check should pass

5. ✅ **Staff Dashboard**
   - Should load without errors
   - Role check should pass

## Prevention

**Best Practice**: Always use explicit column names in Supabase queries when using table joins to avoid ambiguous column references.

```typescript
// ✅ GOOD - Explicit columns
.select('id, email, role_id, roles(id, name)')

// ❌ BAD - Wildcard with joins
.select('*, roles(*)')
```

## Next Steps

1. Refresh your browser at `http://localhost:3000`
2. If you're on the pending page, click "Check Status"
3. Verify you're redirected to the admin dashboard
4. Test the user management page to ensure all queries work

---

**Status**: All database queries have been fixed and type errors resolved. No compilation errors remaining.

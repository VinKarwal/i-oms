# Phase 1 Task 2 - Testing Guide

## 🧪 How to Test the New Features

### Prerequisites
1. Dev server is running: `npm run dev`
2. Database migration completed (001_initial_schema_safe.sql)
3. You have a user account with Admin role assigned

---

## Test 1: Admin Dashboard Access

1. **Open**: http://localhost:3000
2. **Expected**: Automatically redirected to `/login` if not logged in
3. **Action**: Sign in with your admin account
4. **Expected**: Redirected to `/admin` dashboard
5. **Verify**:
   - ✅ Sidebar shows on left (desktop)
   - ✅ Top bar shows your name and "Admin" badge
   - ✅ Dashboard shows "Total Users" and "Pending Roles" cards
   - ✅ Can click sidebar items to navigate

---

## Test 2: Sidebar Collapse

1. **On `/admin` dashboard**
2. **Action**: Click the collapse button (< icon) in sidebar
3. **Expected**: Sidebar collapses to icon-only mode
4. **Verify**:
   - ✅ Sidebar width reduces
   - ✅ Only icons visible
   - ✅ Hover shows tooltips
   - ✅ Click again to expand

---

## Test 3: User Management Page

1. **Action**: Click "User Management" in sidebar
2. **Expected**: Navigate to `/admin/users`
3. **Verify**:
   - ✅ Table shows all registered users
   - ✅ Your account shows "Admin" badge
   - ✅ New users show "No Role" badge (amber/orange)
   - ✅ Search box at top

---

## Test 4: Assign Role to User

1. **On `/admin/users` page**
2. **Action**: Click Edit icon (pencil) next to a user without a role
3. **Expected**: Dialog opens with role selector
4. **Action**: Select "Manager" or "Staff" from dropdown
5. **Action**: Click "Assign Role"
6. **Verify**:
   - ✅ Dialog closes
   - ✅ User's role badge updates in table
   - ✅ No page reload

---

## Test 5: Search Users

1. **On `/admin/users` page**
2. **Action**: Type part of an email in search box
3. **Expected**: Table filters to matching users
4. **Verify**:
   - ✅ Only matching users shown
   - ✅ Clear search shows all users again

---

## Test 6: Remove User Role

1. **On `/admin/users` page**
2. **Action**: Click trash icon next to a user with a role
3. **Expected**: Confirmation dialog opens
4. **Action**: Click "Remove Role"
5. **Verify**:
   - ✅ Dialog closes
   - ✅ User's role changes to "No Role" badge
   - ✅ If that user is logged in, they'll be redirected to `/pending`

---

## Test 7: Mobile Navigation (Bottom Tab Bar)

1. **Action**: Resize browser window to mobile size (< 768px wide)
   - OR open Chrome DevTools (F12) and toggle device toolbar
2. **Expected**: 
   - Sidebar disappears
   - Bottom tab bar appears with 5 icons
3. **Verify**:
   - ✅ Bottom nav shows: Dashboard, Users, Inventory, Tasks, Reports
   - ✅ Current page highlighted
   - ✅ Clicking tabs navigates
   - ✅ Tabs have labels below icons

---

## Test 8: Top Bar User Menu

1. **Action**: Click your avatar/initials in top-right corner
2. **Expected**: Dropdown menu opens
3. **Verify**:
   - ✅ Shows your name and email
   - ✅ Shows role badge
   - ✅ "Profile" and "Settings" grayed out (coming soon)
   - ✅ "Sign Out" in red at bottom
4. **Action**: Click "Sign Out"
5. **Expected**: Redirected to `/login`

---

## Test 9: Role-Based Access Control

### Test with Manager Account
1. **Action**: Create a second user account
2. **Action**: As admin, assign them "Manager" role
3. **Action**: Sign out and sign in with Manager account
4. **Expected**: Redirected to `/manager` dashboard
5. **Verify**:
   - ✅ Can't access `/admin` routes
   - ✅ Sidebar shows only Manager menu items
   - ✅ Trying to visit `/admin` redirects back to `/manager`

### Test with Staff Account
1. **Action**: Create third user or change Manager to Staff
2. **Action**: Assign "Staff" role
3. **Action**: Sign in with Staff account
4. **Expected**: Redirected to `/staff` dashboard
5. **Verify**:
   - ✅ Can't access `/admin` or `/manager` routes
   - ✅ Sidebar shows only Staff menu items (Dashboard, Inventory, My Tasks)
   - ✅ Bottom nav optimized for staff workflow

---

## Test 10: No Role (Pending) Page

1. **Action**: Create a new user account
2. **Don't assign a role**
3. **Action**: Sign in with that account
4. **Expected**: Redirected to `/pending` page
5. **Verify**:
   - ✅ Shows "Waiting for Role Assignment" message
   - ✅ Clock icon
   - ✅ Shows user email
   - ✅ "Check Status" button (refreshes page)
   - ✅ "Sign Out" button works
6. **Action**: As admin, assign role to this user
7. **Action**: As pending user, click "Check Status"
8. **Expected**: Redirected to role-specific dashboard

---

## Test 11: Dashboard Stats (Admin)

1. **On `/admin` dashboard**
2. **Verify cards show**:
   - ✅ Total Users: Actual count of registered users
   - ✅ Pending Roles: Count of users without roles
   - ✅ Inventory Items: 0 (Phase 2 feature)
   - ✅ Active Tasks: 0 (Phase 3 feature)

---

## Test 12: Navigation Consistency

1. **Action**: Navigate between different pages using sidebar
2. **Verify**:
   - ✅ Active page highlighted in sidebar
   - ✅ Top bar remains consistent
   - ✅ User info always visible
   - ✅ URL changes correctly
   - ✅ Browser back/forward works

---

## Test 13: Dark Mode (if supported)

1. **Action**: Change system theme to dark mode
2. **Verify**:
   - ✅ All components adapt to dark theme
   - ✅ Sidebar background changes
   - ✅ Text remains readable
   - ✅ Cards have appropriate contrast

---

## Test 14: Responsive Breakpoints

Test at different widths:

### Desktop (>= 1024px)
- ✅ Sidebar visible
- ✅ Multi-column dashboard cards
- ✅ No bottom nav

### Tablet (768px - 1023px)
- ✅ Sidebar visible but collapsible
- ✅ 2-column card layout
- ✅ No bottom nav

### Mobile (< 768px)
- ✅ Sidebar hidden
- ✅ Bottom tab bar visible
- ✅ Single-column layout
- ✅ Hamburger menu in top bar

---

## 🐛 Common Issues & Solutions

### Issue: Can't access admin dashboard
- **Check**: Your user has "Admin" role assigned
- **Fix**: Run SQL to assign admin role:
  ```sql
  update public.profiles
  set role_id = (select id from public.roles where name = 'Admin')
  where email = 'your-email@example.com';
  ```

### Issue: Users table is empty
- **Check**: Users have registered
- **Fix**: Sign up a few test accounts first

### Issue: Role changes don't appear
- **Check**: Browser might be caching
- **Fix**: Hard refresh (Ctrl+Shift+R) or use incognito

### Issue: Middleware warnings in console
- **Note**: The middleware deprecation warning is expected
- **Safe to ignore**: It still works correctly

### Issue: Bottom nav not showing on mobile
- **Check**: Window width < 768px
- **Fix**: Resize browser or use device emulator

---

## ✅ All Tests Passed?

If all tests pass, Phase 1 Task 2 is complete! 🎉

**What you've verified:**
- ✅ Role-based routing works
- ✅ Admin can manage users
- ✅ Sidebar navigation functional
- ✅ Mobile bottom nav works
- ✅ Top bar user menu works
- ✅ Search and filters work
- ✅ CRUD operations work
- ✅ Responsive design works
- ✅ Access control enforced

**Ready for Phase 2: Core Inventory System** 🚀

# ✅ Setup Checklist

Use this checklist to get your I-OMS system running:

## Pre-Development Setup

- [ ] **1. Add Supabase Credentials**
  - Open `.env.local`
  - Add your `NEXT_PUBLIC_SUPABASE_URL`
  - Add your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Save the file

- [ ] **2. Run Database Migration**
  - Open your Supabase Dashboard
  - Navigate to SQL Editor
  - Open `supabase/migrations/001_initial_schema.sql`
  - Copy all content
  - Paste into Supabase SQL Editor
  - Click "Run"
  - Verify: Should see "Success" message

## First Run

- [ ] **3. Start Development Server**
  ```bash
  npm run dev
  ```
  - Should start on http://localhost:3000
  - No errors in terminal

- [ ] **4. Test Login Page**
  - Open http://localhost:3000
  - Should redirect to `/login`
  - See login form with Supabase UI

- [ ] **5. Create First User**
  - Click "Sign up" tab
  - Enter email and password
  - Click "Sign Up"
  - Should redirect to dashboard

- [ ] **6. Assign Admin Role**
  - Go back to Supabase Dashboard
  - Open SQL Editor
  - Run this query (replace email):
    ```sql
    update public.profiles
    set role_id = (select id from public.roles where name = 'Admin')
    where email = 'your-email@example.com';
    ```
  - Should see "1 row updated"

- [ ] **7. Verify Dashboard Access**
  - Refresh the dashboard page
  - Should now show "Admin" as role
  - No "No role assigned" warning

## Verification Tests

- [ ] **Sign Out & Sign In**
  - Click "Sign Out" button
  - Should redirect to `/login`
  - Sign in with same credentials
  - Should redirect back to `/dashboard`

- [ ] **Protected Routes Work**
  - Sign out
  - Try to visit http://localhost:3000/dashboard
  - Should redirect to `/login`

- [ ] **Session Persistence**
  - Sign in
  - Close browser tab
  - Open new tab to http://localhost:3000
  - Should still be signed in (redirects to dashboard)

## Optional Setup

- [ ] **Add PWA Icons** (can skip for now)
  - Generate icons using https://realfavicongenerator.net/
  - Place in `public/icons/` directory
  - Named as: icon-72x72.png, icon-96x96.png, etc.

- [ ] **Test on Mobile**
  - Find your local IP (ipconfig/ifconfig)
  - Open http://YOUR_IP:3000 on phone
  - Login should work
  - Can test "Add to Home Screen"

## Troubleshooting

If something doesn't work, check:

- [ ] `.env.local` has correct credentials (no typos)
- [ ] Database migration ran successfully
- [ ] Dev server is running without errors
- [ ] Browser console has no errors (F12)
- [ ] Cleared browser cache/cookies

## Success Criteria

✅ You're ready to proceed if:
- Can sign up for an account
- Can sign in with email/password
- Dashboard shows user info and role
- Sign out works
- Protected routes redirect to login
- No console errors

## Next Steps

Once all checkboxes are complete:
1. Read `PHASE1_TASK1_COMPLETE.md` for summary
2. Ready to build role-specific dashboards
3. Continue with Phase 1 remaining tasks

---

**Stuck?** Check `SETUP.md` for detailed troubleshooting guide.

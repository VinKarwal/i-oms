# Quick Start Guide

## Immediate Actions Needed

### 1. Configure Supabase (2 minutes)
```bash
# Edit .env.local and add your credentials:
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
```

### 2. Run Database Migration (1 minute)
- Open Supabase Dashboard → SQL Editor
- Copy/paste content from `supabase/migrations/001_initial_schema.sql`
- Click "Run"

### 3. Start Development Server
```bash
npm run dev
```

### 4. Create First User
- Go to http://localhost:3000
- Sign up with email/password
- You'll see dashboard with "No role assigned" warning

### 5. Assign Admin Role
Run in Supabase SQL Editor:
```sql
update public.profiles
set role_id = (select id from public.roles where name = 'Admin')
where email = 'your-email@example.com';
```

## That's it! 🎉

Your authentication system is ready. Next steps:
- Build role-specific dashboards
- Add navigation menu
- Create admin panel for role management

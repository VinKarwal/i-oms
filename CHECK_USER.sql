-- Test if your current session can access the profile
-- Run this in Supabase SQL Editor

-- Check your user in auth.users
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    last_sign_in_at
FROM auth.users
WHERE email = 'vinaypratapkarwal@gmail.com';

-- Check if profile exists
SELECT 
    id,
    email,
    full_name,
    role_id,
    created_at
FROM profiles
WHERE email = 'vinaypratapkarwal@gmail.com';

-- Check the role details
SELECT 
    p.email,
    p.role_id,
    r.name as role_name,
    r.permissions
FROM profiles p
LEFT JOIN roles r ON p.role_id = r.id
WHERE p.email = 'vinaypratapkarwal@gmail.com';

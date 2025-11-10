-- FORCE PostgREST SCHEMA CACHE REFRESH
-- Supabase's REST API caches the schema including RLS policies
-- This forces it to reload

-- Option 1: Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- Option 2: If that doesn't work, make a small schema change to trigger cache invalidation
-- Add a comment to force schema change detection
COMMENT ON TABLE public.profiles IS 'User profiles - cache bust';
COMMENT ON TABLE public.roles IS 'User roles - cache bust';

-- Verify the change
SELECT 
    'Schema cache refresh triggered' as status,
    obj_description('public.profiles'::regclass) as profiles_comment,
    obj_description('public.roles'::regclass) as roles_comment;

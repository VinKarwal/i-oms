-- Add missing roles policy for JOINs to work

CREATE POLICY "Anyone can view roles"
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);

-- Refresh cache
NOTIFY pgrst, 'reload schema';

-- Verify
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename IN ('profiles', 'roles')
ORDER BY tablename, policyname;

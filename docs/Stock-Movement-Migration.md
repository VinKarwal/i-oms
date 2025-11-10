# Stock Movement System - Migration Instructions

## Step 1: Apply Database Migration

1. Open your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to your project
3. Go to **SQL Editor** in the left sidebar
4. Click **"New query"**
5. Copy the entire contents of `/supabase/migrations/20250110000002_stock_movements.sql`
6. Paste into the SQL editor
7. Click **"Run"** or press `Ctrl+Enter`
8. Verify success (should see "Success. No rows returned")

## Step 2: Create Storage Bucket

Follow the instructions in `/docs/Supabase-Storage-Setup.md` to create the storage bucket for movement attachments.

You can either:
- **Option A**: Run the SQL commands in the SQL Editor
- **Option B**: Create the bucket manually via Dashboard > Storage > New Bucket

## Step 3: Verify Migration

Run these queries to verify the migration was successful:

```sql
-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public'
  AND table_name = 'stock_movements'
);

-- Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'stock_movements'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'stock_movements';

-- Check triggers
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'stock_movements';
```

## Step 4: Test Basic Functionality

After migration, test by running:

```sql
-- Test: Get pending movements function
SELECT * FROM get_pending_movements();

-- Test: Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'stock_movements';
```

## Troubleshooting

### If migration fails:
1. Check if you have the necessary permissions
2. Verify that the `items` and `locations` tables exist
3. Check for any existing `stock_movements` table that might conflict
4. Review error messages in the Supabase dashboard

### To rollback (if needed):
```sql
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP FUNCTION IF EXISTS update_stock_on_approval() CASCADE;
DROP FUNCTION IF EXISTS set_before_quantity() CASCADE;
DROP FUNCTION IF EXISTS apply_immediate_stock_update() CASCADE;
DROP FUNCTION IF EXISTS get_item_movement_history(UUID, INT, INT) CASCADE;
DROP FUNCTION IF EXISTS get_pending_movements() CASCADE;
```

## Next Steps

Once migration is complete:
1. Restart your Next.js development server
2. The API endpoints will be available
3. Proceed to test the UI components

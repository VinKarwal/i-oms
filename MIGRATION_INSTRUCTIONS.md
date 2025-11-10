# Phase 2 Task 1: Database Migration Instructions

## 🎯 Step 1: Apply Database Migration

You need to run the migration SQL file in your Supabase database.

### Option A: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project (eofiruwbwrnvplheomkq)
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire contents of `supabase/migrations/20250110000001_inventory_system.sql`
6. Paste into the SQL editor
7. Click **Run** (or press Ctrl+Enter)
8. Verify success - you should see "Phase 2 Task 1 migration completed successfully" in the results

### Option B: Using Supabase CLI (If installed)

```bash
npx supabase db push
```

### What This Migration Does:

✅ Creates `item_locations` junction table for multi-location stock tracking  
✅ Adds performance indexes on all inventory tables  
✅ Sets up Row Level Security (RLS) policies  
✅ Creates helper functions:
   - `get_item_total_stock()` - Calculate total stock across locations
   - `get_low_stock_items()` - Find items below threshold  
✅ Adds automatic timestamp triggers

### Verification:

After running, verify in Supabase Dashboard → Database → Tables:
- You should see `item_locations` table
- `locations`, `items`, and `stock_movements` should have indexes

---

## ⚠️ IMPORTANT: Run Migration Before Proceeding

Once you've run the migration successfully, let me know and I'll continue building the UI!

Type **"migration done"** when ready. 🚀

# Supabase Database Migrations

## How to Run Migrations

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the SQL from each migration file
4. Run them in order (001, 002, etc.)

## Migration Files

### 001_initial_schema.sql
- Creates `roles` table with fixed roles (Admin, Manager, Staff)
- Creates `profiles` table (extends auth.users)
- Sets up Row Level Security (RLS) policies
- Creates trigger to auto-create profile on user signup
- Adds indexes for performance

## Important Notes

- **First Admin User**: After running migrations and creating your first user, you need to manually assign them the Admin role in the Supabase dashboard:
  
  ```sql
  -- Run this in SQL Editor after creating your first user
  update public.profiles
  set role_id = (select id from public.roles where name = 'Admin')
  where email = 'your-admin-email@example.com';
  ```

- **Role Assignment**: All new users will be created without a role. An admin must manually assign roles through the dashboard or admin interface (to be built in Phase 1).

## Next Migrations (Future Phases)

- 002_locations.sql (Phase 2)
- 003_inventory.sql (Phase 2)
- 004_stock_movements.sql (Phase 2)
- 005_tasks.sql (Phase 3)
- 006_suppliers_orders.sql (Phase 4)
- 007_notifications.sql (Phase 5)
- 008_audit_logs.sql (Phase 7)

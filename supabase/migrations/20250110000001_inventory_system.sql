-- =====================================================
-- Phase 2 Task 1: Core Inventory System Migration
-- =====================================================
-- This migration creates the foundation for inventory management
-- with multi-location stock tracking

-- =====================================================
-- 1. CREATE ITEM_LOCATIONS JUNCTION TABLE
-- =====================================================
-- This table enables items to have stock distributed across multiple locations
CREATE TABLE IF NOT EXISTS public.item_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  quantity NUMERIC(15, 3) DEFAULT 0 NOT NULL CHECK (quantity >= 0),
  
  -- Per-location thresholds (industry standard)
  min_threshold NUMERIC(15, 3),
  max_threshold NUMERIC(15, 3),
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Constraints
  CONSTRAINT unique_item_location UNIQUE (item_id, location_id),
  CONSTRAINT valid_location_thresholds CHECK (
    (min_threshold IS NULL OR max_threshold IS NULL OR min_threshold <= max_threshold)
  )
);

COMMENT ON TABLE public.item_locations IS 'Junction table for multi-location inventory with per-location stock levels and thresholds';

-- =====================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Locations table indexes
CREATE INDEX IF NOT EXISTS idx_locations_parent_id ON public.locations(parent_id);
CREATE INDEX IF NOT EXISTS idx_locations_type ON public.locations(type);
CREATE INDEX IF NOT EXISTS idx_locations_path ON public.locations(path);
CREATE INDEX IF NOT EXISTS idx_locations_active ON public.locations(is_active) WHERE is_active = true;

-- Items table indexes
CREATE INDEX IF NOT EXISTS idx_items_sku ON public.items(sku);
CREATE INDEX IF NOT EXISTS idx_items_barcode ON public.items(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_items_category ON public.items(category);
CREATE INDEX IF NOT EXISTS idx_items_active ON public.items(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_items_location_id ON public.items(location_id);

-- Item_locations indexes
CREATE INDEX IF NOT EXISTS idx_item_locations_item_id ON public.item_locations(item_id);
CREATE INDEX IF NOT EXISTS idx_item_locations_location_id ON public.item_locations(location_id);

-- Stock_movements indexes (for future use)
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_id ON public.stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON public.stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_performed_at ON public.stock_movements(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_from_location ON public.stock_movements(from_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_to_location ON public.stock_movements(to_location_id);

-- =====================================================
-- 3. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- LOCATIONS RLS POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view active locations" ON public.locations;
DROP POLICY IF EXISTS "View all locations for privileged users" ON public.locations;

-- All authenticated users can view active locations
CREATE POLICY "Authenticated users can view active locations"
ON public.locations FOR SELECT
TO authenticated
USING (is_active = true);

-- Admins and Managers can insert locations (via app with service key or direct)
-- We'll handle this at application level with proper role checks

-- Users can view inactive locations if they're admin/manager (handled by app)
CREATE POLICY "View all locations for privileged users"
ON public.locations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role_id IN (
      SELECT id FROM public.roles WHERE name IN ('Admin', 'Manager')
    )
  )
);

-- =====================================================
-- ITEMS RLS POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view active items" ON public.items;
DROP POLICY IF EXISTS "View all items for privileged users" ON public.items;

-- All authenticated users can view active items
CREATE POLICY "Authenticated users can view active items"
ON public.items FOR SELECT
TO authenticated
USING (is_active = true);

-- Privileged users can view all items (including inactive)
CREATE POLICY "View all items for privileged users"
ON public.items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role_id IN (
      SELECT id FROM public.roles WHERE name IN ('Admin', 'Manager')
    )
  )
);

-- =====================================================
-- ITEM_LOCATIONS RLS POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view item locations" ON public.item_locations;
DROP POLICY IF EXISTS "View all item locations for privileged users" ON public.item_locations;

-- All authenticated users can view item locations for active items
CREATE POLICY "Authenticated users can view item locations"
ON public.item_locations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.items
    WHERE items.id = item_locations.item_id
    AND items.is_active = true
  )
);

-- Privileged users can view all item locations
CREATE POLICY "View all item locations for privileged users"
ON public.item_locations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role_id IN (
      SELECT id FROM public.roles WHERE name IN ('Admin', 'Manager')
    )
  )
);

-- =====================================================
-- STOCK_MOVEMENTS RLS POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view stock movements" ON public.stock_movements;

-- All authenticated users can view stock movements
CREATE POLICY "Authenticated users can view stock movements"
ON public.stock_movements FOR SELECT
TO authenticated
USING (true);

-- Note: INSERT/UPDATE/DELETE policies will be handled via API routes
-- with service role key to avoid RLS recursion issues (learned from Phase 1)

-- =====================================================
-- 4. FUNCTIONS FOR INVENTORY MANAGEMENT
-- =====================================================

-- Function to calculate total stock for an item across all locations
CREATE OR REPLACE FUNCTION get_item_total_stock(p_item_id UUID)
RETURNS NUMERIC AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(quantity) FROM public.item_locations WHERE item_id = p_item_id),
    0
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_item_total_stock IS 'Calculate total stock quantity for an item across all locations';

-- Function to get low stock items by location
CREATE OR REPLACE FUNCTION get_low_stock_items(p_location_id UUID DEFAULT NULL)
RETURNS TABLE (
  item_id UUID,
  item_name TEXT,
  location_id UUID,
  location_name TEXT,
  current_quantity NUMERIC,
  min_threshold NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    il.item_id,
    i.name AS item_name,
    il.location_id,
    l.name AS location_name,
    il.quantity AS current_quantity,
    il.min_threshold
  FROM public.item_locations il
  JOIN public.items i ON il.item_id = i.id
  JOIN public.locations l ON il.location_id = l.id
  WHERE i.is_active = true
    AND il.min_threshold IS NOT NULL
    AND il.quantity <= il.min_threshold
    AND (p_location_id IS NULL OR il.location_id = p_location_id);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_low_stock_items IS 'Get items with stock at or below minimum threshold, optionally filtered by location';

-- =====================================================
-- 5. TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- =====================================================

-- Trigger for item_locations updated_at
CREATE OR REPLACE FUNCTION update_item_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_item_locations_updated_at
  BEFORE UPDATE ON public.item_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_item_locations_updated_at();

-- =====================================================
-- 6. INITIAL DATA SETUP
-- =====================================================

-- Note: We'll create a setup wizard in the app for first-time location configuration
-- No seed data here to keep the system clean

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Verify tables exist
DO $$
BEGIN
  ASSERT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'item_locations'),
    'item_locations table was not created';
  
  RAISE NOTICE 'Phase 2 Task 1 migration completed successfully';
  RAISE NOTICE 'Created: item_locations table';
  RAISE NOTICE 'Added: Performance indexes on locations, items, item_locations, stock_movements';
  RAISE NOTICE 'Added: RLS policies for multi-user access';
  RAISE NOTICE 'Added: Helper functions for stock calculations';
END $$;

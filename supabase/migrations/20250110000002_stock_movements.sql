-- Stock Movements System Migration
-- This migration creates the stock_movements table with full tracking capabilities

-- Drop existing table if it exists (for clean migration)
DROP TABLE IF EXISTS stock_movements CASCADE;

-- Create stock_movements table
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  
  -- Movement details
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'receive', 'production', 'return_from_customer',
    'sale', 'transfer_out', 'disposal', 'return_to_supplier',
    'transfer_in', 'adjustment_increase', 'adjustment_decrease'
  )),
  quantity DECIMAL(10, 2) NOT NULL CHECK (quantity > 0),
  
  -- Tracking
  before_quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  after_quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  
  -- Cost tracking
  unit_cost DECIMAL(10, 2),
  total_value DECIMAL(12, 2),
  
  -- Identification
  batch_number TEXT,
  serial_number TEXT,
  
  -- Reference and notes
  reference_number TEXT, -- PO, SO, DO number etc.
  reason TEXT NOT NULL,
  notes TEXT,
  
  -- File attachment
  attachment_url TEXT,
  
  -- Transfer linking (for paired transfer movements)
  transfer_reference TEXT,
  
  -- Approval workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Audit fields
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  -- Soft delete
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Verify table was created
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_movements') THEN
    RAISE EXCEPTION 'stock_movements table was not created';
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_id ON stock_movements(item_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_stock_movements_location_id ON stock_movements(location_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type ON stock_movements(movement_type) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_stock_movements_status ON stock_movements(status) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_stock_movements_transfer_ref ON stock_movements(transfer_reference) WHERE transfer_reference IS NOT NULL AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_stock_movements_batch_number ON stock_movements(batch_number) WHERE batch_number IS NOT NULL AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_stock_movements_serial_number ON stock_movements(serial_number) WHERE serial_number IS NOT NULL AND is_active = true;

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_location ON stock_movements(item_id, location_id, created_at DESC) WHERE is_active = true;

-- Function to update item_locations quantity after movement approval
CREATE OR REPLACE FUNCTION update_stock_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update stock when status changes to 'approved'
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- Calculate the quantity change based on movement type
    DECLARE
      qty_change DECIMAL(10, 2);
    BEGIN
      -- Determine if this is an increase or decrease
      IF NEW.movement_type IN ('receive', 'production', 'return_from_customer', 'transfer_in', 'adjustment_increase') THEN
        qty_change := NEW.quantity;
      ELSE
        qty_change := -NEW.quantity;
      END IF;
      
      -- Update the item_locations quantity
      UPDATE item_locations
      SET quantity = quantity + qty_change,
          updated_at = NOW()
      WHERE item_id = NEW.item_id 
        AND location_id = NEW.location_id;
      
      -- If item_location doesn't exist for this combination, create it
      IF NOT FOUND THEN
        INSERT INTO item_locations (item_id, location_id, quantity, min_threshold, max_threshold)
        VALUES (NEW.item_id, NEW.location_id, GREATEST(0, qty_change), 0, 0);
      END IF;
      
      -- Update the after_quantity in the movement record
      UPDATE stock_movements
      SET after_quantity = (
        SELECT quantity FROM item_locations 
        WHERE item_id = NEW.item_id AND location_id = NEW.location_id
      )
      WHERE id = NEW.id;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic stock updates on approval
CREATE TRIGGER trigger_update_stock_on_approval
  AFTER UPDATE OF status ON stock_movements
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status = 'pending')
  EXECUTE FUNCTION update_stock_on_approval();

-- Function to capture before_quantity when creating movement
CREATE OR REPLACE FUNCTION set_before_quantity()
RETURNS TRIGGER AS $$
BEGIN
  -- Get current quantity from item_locations
  SELECT COALESCE(quantity, 0) INTO NEW.before_quantity
  FROM item_locations
  WHERE item_id = NEW.item_id AND location_id = NEW.location_id;
  
  -- If no record exists, before_quantity is 0 (already set by default)
  IF NOT FOUND THEN
    NEW.before_quantity := 0;
  END IF;
  
  -- Calculate after_quantity based on movement type
  IF NEW.movement_type IN ('receive', 'production', 'return_from_customer', 'transfer_in', 'adjustment_increase') THEN
    NEW.after_quantity := NEW.before_quantity + NEW.quantity;
  ELSE
    NEW.after_quantity := NEW.before_quantity - NEW.quantity;
  END IF;
  
  -- Calculate total_value if unit_cost is provided
  IF NEW.unit_cost IS NOT NULL THEN
    NEW.total_value := NEW.unit_cost * NEW.quantity;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to set before_quantity
CREATE TRIGGER trigger_set_before_quantity
  BEFORE INSERT ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION set_before_quantity();

-- Function to apply stock changes immediately for admin/manager created movements
CREATE OR REPLACE FUNCTION apply_immediate_stock_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If movement is created with 'approved' status, update stock immediately
  IF NEW.status = 'approved' THEN
    DECLARE
      qty_change DECIMAL(10, 2);
    BEGIN
      -- Determine quantity change
      IF NEW.movement_type IN ('receive', 'production', 'return_from_customer', 'transfer_in', 'adjustment_increase') THEN
        qty_change := NEW.quantity;
      ELSE
        qty_change := -NEW.quantity;
      END IF;
      
      -- Update item_locations
      UPDATE item_locations
      SET quantity = quantity + qty_change,
          updated_at = NOW()
      WHERE item_id = NEW.item_id 
        AND location_id = NEW.location_id;
      
      -- Create if doesn't exist
      IF NOT FOUND THEN
        INSERT INTO item_locations (item_id, location_id, quantity, min_threshold, max_threshold)
        VALUES (NEW.item_id, NEW.location_id, GREATEST(0, qty_change), 0, 0);
      END IF;
      
      -- Update after_quantity
      SELECT quantity INTO NEW.after_quantity
      FROM item_locations
      WHERE item_id = NEW.item_id AND location_id = NEW.location_id;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for immediate stock updates
CREATE TRIGGER trigger_apply_immediate_stock_update
  AFTER INSERT ON stock_movements
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION apply_immediate_stock_update();

-- Helper function to get movement history for an item
CREATE OR REPLACE FUNCTION get_item_movement_history(
  p_item_id UUID,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  movement_type TEXT,
  quantity DECIMAL,
  before_quantity DECIMAL,
  after_quantity DECIMAL,
  location_name TEXT,
  location_path TEXT,
  reason TEXT,
  reference_number TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  created_by_email TEXT,
  approved_by_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sm.id,
    sm.movement_type,
    sm.quantity,
    sm.before_quantity,
    sm.after_quantity,
    l.name as location_name,
    l.path as location_path,
    sm.reason,
    sm.reference_number,
    sm.status,
    sm.created_at,
    u1.email as created_by_email,
    u2.email as approved_by_email
  FROM stock_movements sm
  JOIN locations l ON sm.location_id = l.id
  LEFT JOIN auth.users u1 ON sm.created_by = u1.id
  LEFT JOIN auth.users u2 ON sm.approved_by = u2.id
  WHERE sm.item_id = p_item_id
    AND sm.is_active = true
  ORDER BY sm.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get pending movements for approval
CREATE OR REPLACE FUNCTION get_pending_movements()
RETURNS TABLE (
  id UUID,
  item_sku TEXT,
  item_name TEXT,
  location_name TEXT,
  movement_type TEXT,
  quantity DECIMAL,
  reason TEXT,
  created_at TIMESTAMPTZ,
  created_by_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sm.id,
    i.sku as item_sku,
    i.name as item_name,
    l.name as location_name,
    sm.movement_type,
    sm.quantity,
    sm.reason,
    sm.created_at,
    u.email as created_by_email
  FROM stock_movements sm
  JOIN items i ON sm.item_id = i.id
  JOIN locations l ON sm.location_id = l.id
  LEFT JOIN auth.users u ON sm.created_by = u.id
  WHERE sm.status = 'pending'
    AND sm.is_active = true
  ORDER BY sm.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to view movements
CREATE POLICY "Users can view stock movements"
  ON stock_movements
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Policy: Allow authenticated users to create movements
CREATE POLICY "Users can create stock movements"
  ON stock_movements
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Allow users to update their own pending movements
CREATE POLICY "Users can update their own pending movements"
  ON stock_movements
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() AND status = 'pending')
  WITH CHECK (created_by = auth.uid() AND status = 'pending');

-- Policy: Allow managers/admins to approve movements (via service role in API)
-- Note: Approval will be handled via service role key in API for proper role checking

-- Add comment to table
COMMENT ON TABLE stock_movements IS 'Tracks all inventory stock movements with approval workflow';
COMMENT ON COLUMN stock_movements.movement_type IS 'Type of movement: receive, sale, transfer, adjustment, etc.';
COMMENT ON COLUMN stock_movements.status IS 'Approval status: pending, approved, rejected';
COMMENT ON COLUMN stock_movements.transfer_reference IS 'Links paired transfer movements (transfer_out and transfer_in)';
COMMENT ON COLUMN stock_movements.batch_number IS 'Batch number for inventory tracking';
COMMENT ON COLUMN stock_movements.serial_number IS 'Serial number for individual item tracking';

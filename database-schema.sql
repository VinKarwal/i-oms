-- =====================================================
-- I-OMS Database Schema
-- Intelligent Operations Management System
-- =====================================================
-- This schema is designed for Supabase (PostgreSQL)
-- Execute in order: Enums → Tables → Indexes → RLS Policies → Functions → Triggers
-- =====================================================

-- =====================================================
-- ENUMS
-- =====================================================

-- Movement types for stock operations
CREATE TYPE movement_type AS ENUM (
  'inbound',      -- Receiving stock
  'outbound',     -- Dispatching/selling stock
  'return',       -- Customer/supplier returns
  'damage',       -- Damaged/expired items removal
  'adjustment',   -- Manual stock corrections
  'transfer'      -- Moving between locations
);

-- Task status workflow
CREATE TYPE task_status AS ENUM (
  'pending',      -- Created, not assigned
  'assigned',     -- Assigned to user
  'in_progress',  -- User working on it
  'completed',    -- Task finished
  'cancelled'     -- Task cancelled
);

-- Task priority levels
CREATE TYPE task_priority AS ENUM (
  'critical',     -- Immediate action required
  'high',         -- Important, address soon
  'medium',       -- Normal priority
  'low'           -- Can be delayed
);

-- Purchase order status workflow
CREATE TYPE po_status AS ENUM (
  'draft',        -- Being created
  'requested',    -- Waiting for approval
  'ordered',      -- Sent to supplier
  'confirmed',    -- Supplier confirmed
  'in_transit',   -- Shipped, on the way
  'received',     -- Delivered and verified
  'cancelled'     -- Order cancelled
);

-- Notification priority levels
CREATE TYPE notification_priority AS ENUM (
  'critical',     -- Urgent alerts
  'high',         -- Important notifications
  'medium',       -- Standard notifications
  'low'           -- Informational
);

-- =====================================================
-- TABLES
-- =====================================================

-- -----------------------------------------------------
-- 1. ROLES TABLE
-- -----------------------------------------------------
CREATE TABLE public.roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_fixed BOOLEAN DEFAULT false, -- Admin, Manager, Staff are fixed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert fixed roles
INSERT INTO public.roles (name, description, is_fixed, permissions) VALUES
  ('Admin', 'Full system access with all permissions', true, '["all"]'::jsonb),
  ('Manager', 'Team and inventory management capabilities', true, '["inventory:read", "inventory:write", "tasks:manage", "orders:manage", "reports:view", "suppliers:manage"]'::jsonb),
  ('Staff', 'Basic warehouse operations', true, '["inventory:read", "tasks:view", "tasks:update", "scanner:use"]'::jsonb);

COMMENT ON TABLE public.roles IS 'User roles with permission sets. Fixed roles cannot be deleted.';

-- -----------------------------------------------------
-- 2. PROFILES TABLE (extends auth.users)
-- -----------------------------------------------------
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  location_id UUID, -- References public.locations(id), added after locations table
  preferences JSONB DEFAULT '{
    "notifications": {
      "email": false,
      "in_app": true,
      "frequency": "realtime"
    },
    "theme": "light",
    "language": "en"
  }'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.profiles IS 'Extended user profile information beyond Supabase auth';

-- -----------------------------------------------------
-- 3. LOCATIONS TABLE
-- -----------------------------------------------------
CREATE TABLE public.locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- e.g., 'warehouse', 'zone', 'aisle', 'shelf', 'bin'
  parent_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  path TEXT, -- Hierarchical path like '/warehouse1/zoneA/aisle3'
  level INTEGER DEFAULT 0, -- Depth in hierarchy (0 = root)
  metadata JSONB DEFAULT '{}'::jsonb, -- Custom attributes per location type
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT unique_location_path UNIQUE (path)
);

COMMENT ON TABLE public.locations IS 'Hierarchical location structure for warehouse organization';

-- Add foreign key to profiles after locations table exists
ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_location_id_fkey 
  FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;

-- -----------------------------------------------------
-- 4. ITEMS TABLE (Inventory)
-- -----------------------------------------------------
CREATE TABLE public.items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  barcode TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'piece', -- piece, box, kg, liter, etc.
  
  -- Stock information
  quantity NUMERIC(15, 3) DEFAULT 0 NOT NULL CHECK (quantity >= 0),
  min_threshold NUMERIC(15, 3), -- Alert when stock falls below this
  max_threshold NUMERIC(15, 3), -- Alert when stock exceeds this
  reorder_point NUMERIC(15, 3), -- Automatic reorder trigger
  reorder_quantity NUMERIC(15, 3), -- How much to reorder
  
  -- Location and pricing
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  cost_price NUMERIC(15, 2),
  selling_price NUMERIC(15, 2),
  
  -- Additional tracking
  expiry_date DATE,
  batch_number TEXT,
  serial_number TEXT,
  manufacturer TEXT,
  supplier_sku TEXT,
  
  -- Media and metadata
  image_url TEXT,
  images JSONB DEFAULT '[]'::jsonb, -- Multiple images
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Constraints
  CONSTRAINT valid_thresholds CHECK (
    (min_threshold IS NULL OR max_threshold IS NULL OR min_threshold <= max_threshold)
  ),
  CONSTRAINT valid_prices CHECK (
    (cost_price IS NULL OR cost_price >= 0) AND
    (selling_price IS NULL OR selling_price >= 0)
  )
);

COMMENT ON TABLE public.items IS 'Inventory items with stock levels, pricing, and tracking information';

-- -----------------------------------------------------
-- 5. STOCK_MOVEMENTS TABLE
-- -----------------------------------------------------
CREATE TABLE public.stock_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  movement_type movement_type NOT NULL,
  quantity NUMERIC(15, 3) NOT NULL CHECK (quantity != 0),
  
  -- Location tracking
  from_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  to_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  
  -- Reference tracking (what triggered this movement)
  reference_id UUID, -- PO id, task id, sales order id, etc.
  reference_type TEXT, -- 'purchase_order', 'task', 'sales_order', 'manual'
  
  -- Additional information
  notes TEXT,
  unit_cost NUMERIC(15, 2), -- Cost at time of movement
  
  -- Audit information
  performed_by UUID REFERENCES auth.users(id) NOT NULL,
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT valid_movement_quantity CHECK (
    (movement_type IN ('inbound', 'return') AND quantity > 0) OR
    (movement_type IN ('outbound', 'damage', 'adjustment') AND quantity != 0) OR
    (movement_type = 'transfer' AND from_location_id IS NOT NULL AND to_location_id IS NOT NULL)
  )
);

COMMENT ON TABLE public.stock_movements IS 'Complete audit trail of all inventory movements';

-- -----------------------------------------------------
-- 6. TASKS TABLE
-- -----------------------------------------------------
CREATE TABLE public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'auto-generated', 'recurring'
  status task_status DEFAULT 'pending' NOT NULL,
  priority task_priority DEFAULT 'medium' NOT NULL,
  
  -- Assignment
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  
  -- Scheduling
  due_date TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Recurring tasks
  recurrence_rule TEXT, -- Cron-like pattern: '0 9 * * 1' (every Monday at 9am)
  parent_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL, -- For recurring instances
  
  -- Related entities
  related_item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  related_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  
  -- Additional data
  metadata JSONB DEFAULT '{}'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT valid_completion CHECK (
    (status = 'completed' AND completed_at IS NOT NULL) OR
    (status != 'completed' AND completed_at IS NULL)
  )
);

COMMENT ON TABLE public.tasks IS 'Task management with support for manual, auto-generated, and recurring tasks';

-- -----------------------------------------------------
-- 7. SUPPLIERS TABLE
-- -----------------------------------------------------
CREATE TABLE public.suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE, -- Supplier code/ID
  
  -- Contact information
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  website TEXT,
  
  -- Business terms
  lead_time_days INTEGER DEFAULT 7,
  payment_terms TEXT, -- e.g., 'Net 30', 'COD', '50% advance'
  currency TEXT DEFAULT 'USD',
  
  -- Performance metrics
  rating NUMERIC(2, 1) CHECK (rating >= 0 AND rating <= 5),
  on_time_delivery_rate NUMERIC(5, 2), -- Percentage (0-100)
  total_orders INTEGER DEFAULT 0,
  
  -- Portal access (for supplier portal)
  portal_access_enabled BOOLEAN DEFAULT false,
  portal_token TEXT UNIQUE, -- Unique token for supplier portal login
  
  -- Additional data
  metadata JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.suppliers IS 'Supplier directory with performance tracking and portal access';

-- -----------------------------------------------------
-- 8. PURCHASE_ORDERS TABLE
-- -----------------------------------------------------
CREATE TABLE public.purchase_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number TEXT UNIQUE NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) NOT NULL,
  status po_status DEFAULT 'draft' NOT NULL,
  
  -- Order items (denormalized for simplicity)
  items JSONB NOT NULL, -- [{item_id, item_name, sku, quantity, unit_price, total}]
  
  -- Financial information
  subtotal NUMERIC(15, 2) NOT NULL,
  tax_amount NUMERIC(15, 2) DEFAULT 0,
  shipping_cost NUMERIC(15, 2) DEFAULT 0,
  total_amount NUMERIC(15, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  
  -- Dates
  order_date DATE DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  
  -- Delivery information
  delivery_address TEXT,
  tracking_number TEXT,
  
  -- Additional information
  notes TEXT,
  terms_and_conditions TEXT,
  attachments JSONB DEFAULT '[]'::jsonb, -- Supporting documents
  
  -- Audit
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT valid_po_amounts CHECK (
    subtotal >= 0 AND
    tax_amount >= 0 AND
    shipping_cost >= 0 AND
    total_amount >= 0
  )
);

COMMENT ON TABLE public.purchase_orders IS 'Purchase orders for supplier procurement';

-- -----------------------------------------------------
-- 9. NOTIFICATIONS TABLE
-- -----------------------------------------------------
CREATE TABLE public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Notification content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority notification_priority DEFAULT 'medium' NOT NULL,
  type TEXT NOT NULL, -- 'stock_alert', 'task_assignment', 'order_update', 'system', etc.
  
  -- Reference to related entity
  reference_id UUID,
  reference_type TEXT, -- 'item', 'task', 'purchase_order', etc.
  
  -- Action links
  action_url TEXT, -- Deep link to related entity
  action_label TEXT, -- e.g., 'View Item', 'Complete Task'
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE -- Auto-delete old notifications
);

COMMENT ON TABLE public.notifications IS 'In-app notifications for users with priority routing';

-- -----------------------------------------------------
-- 10. AUDIT_LOGS TABLE
-- -----------------------------------------------------
CREATE TABLE public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Who performed the action
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT, -- Denormalized for historical records
  
  -- What action was performed
  action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'LOGIN', etc.
  table_name TEXT NOT NULL,
  record_id UUID,
  
  -- Data changes
  old_data JSONB,
  new_data JSONB,
  changes JSONB, -- Specific fields that changed
  
  -- Request context
  ip_address INET,
  user_agent TEXT,
  request_path TEXT,
  
  -- Timestamps (immutable)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.audit_logs IS 'Immutable audit trail of all system actions';

-- -----------------------------------------------------
-- 11. REPORTS TABLE
-- -----------------------------------------------------
CREATE TABLE public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- 'daily_summary', 'stock_valuation', 'custom', etc.
  
  -- Report configuration
  config JSONB NOT NULL, -- Filters, columns, date ranges, etc.
  
  -- Access control
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  is_public BOOLEAN DEFAULT false, -- Share with all users
  shared_with UUID[], -- Specific users who can access
  
  -- Scheduling
  is_scheduled BOOLEAN DEFAULT false,
  schedule_cron TEXT, -- Cron pattern for automated reports
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.reports IS 'Saved and scheduled custom reports';

-- -----------------------------------------------------
-- 12. FORECAST_DATA TABLE (Placeholder for future)
-- -----------------------------------------------------
CREATE TABLE public.forecast_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  
  -- Forecast information
  forecast_date DATE NOT NULL,
  predicted_quantity NUMERIC(15, 3) NOT NULL,
  confidence_score NUMERIC(5, 2), -- 0-100 percentage
  
  -- Metadata
  model_version TEXT,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Allow multiple forecasts per item per date (different models)
  CONSTRAINT unique_forecast_per_item_date_version UNIQUE (item_id, forecast_date, model_version)
);

COMMENT ON TABLE public.forecast_data IS 'Sales forecasting predictions from ML model (future implementation)';

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Profiles indexes
CREATE INDEX idx_profiles_role_id ON public.profiles(role_id);
CREATE INDEX idx_profiles_location_id ON public.profiles(location_id);
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- Locations indexes
CREATE INDEX idx_locations_parent_id ON public.locations(parent_id);
CREATE INDEX idx_locations_path ON public.locations USING gin(to_tsvector('english', path));
CREATE INDEX idx_locations_type ON public.locations(type);

-- Items indexes
CREATE INDEX idx_items_sku ON public.items(sku);
CREATE INDEX idx_items_barcode ON public.items(barcode);
CREATE INDEX idx_items_category ON public.items(category);
CREATE INDEX idx_items_location_id ON public.items(location_id);
CREATE INDEX idx_items_name ON public.items USING gin(to_tsvector('english', name));
CREATE INDEX idx_items_low_stock ON public.items(quantity) WHERE quantity <= min_threshold;

-- Stock movements indexes
CREATE INDEX idx_stock_movements_item_id ON public.stock_movements(item_id);
CREATE INDEX idx_stock_movements_performed_at ON public.stock_movements(performed_at DESC);
CREATE INDEX idx_stock_movements_performed_by ON public.stock_movements(performed_by);
CREATE INDEX idx_stock_movements_reference ON public.stock_movements(reference_type, reference_id);
CREATE INDEX idx_stock_movements_type ON public.stock_movements(movement_type);

-- Tasks indexes
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_priority ON public.tasks(priority);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_tasks_related_item ON public.tasks(related_item_id);

-- Suppliers indexes
CREATE INDEX idx_suppliers_code ON public.suppliers(code);
CREATE INDEX idx_suppliers_name ON public.suppliers USING gin(to_tsvector('english', name));

-- Purchase orders indexes
CREATE INDEX idx_purchase_orders_supplier_id ON public.purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX idx_purchase_orders_po_number ON public.purchase_orders(po_number);
CREATE INDEX idx_purchase_orders_created_by ON public.purchase_orders(created_by);
CREATE INDEX idx_purchase_orders_order_date ON public.purchase_orders(order_date DESC);

-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_priority ON public.notifications(priority);
CREATE INDEX idx_notifications_type ON public.notifications(type);
CREATE INDEX idx_notifications_unread_user ON public.notifications(user_id, is_read) WHERE is_read = false;

-- Audit logs indexes
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- Reports indexes
CREATE INDEX idx_reports_created_by ON public.reports(created_by);
CREATE INDEX idx_reports_type ON public.reports(type);

-- Forecast data indexes
CREATE INDEX idx_forecast_data_item_id ON public.forecast_data(item_id);
CREATE INDEX idx_forecast_data_forecast_date ON public.forecast_data(forecast_date);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate PO number
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.po_number IS NULL THEN
    NEW.po_number := 'PO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(NEXTVAL('po_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for PO numbers
CREATE SEQUENCE po_number_seq START 1;

-- Function to log audit trail
CREATE OR REPLACE FUNCTION log_audit_trail()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    user_email,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) VALUES (
    auth.uid(),
    auth.email(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update item quantity after stock movement
CREATE OR REPLACE FUNCTION update_item_quantity_on_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Update item quantity based on movement type
  IF NEW.movement_type = 'inbound' OR NEW.movement_type = 'return' THEN
    UPDATE public.items 
    SET quantity = quantity + NEW.quantity,
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.item_id;
  ELSIF NEW.movement_type = 'outbound' OR NEW.movement_type = 'damage' THEN
    UPDATE public.items 
    SET quantity = quantity - ABS(NEW.quantity),
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.item_id;
  ELSIF NEW.movement_type = 'adjustment' THEN
    UPDATE public.items 
    SET quantity = quantity + NEW.quantity,
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.item_id;
  END IF;
  
  -- Check if low stock threshold reached and create notification
  PERFORM create_low_stock_notification(NEW.item_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to create low stock notification
CREATE OR REPLACE FUNCTION create_low_stock_notification(p_item_id UUID)
RETURNS VOID AS $$
DECLARE
  v_item RECORD;
  v_user RECORD;
BEGIN
  -- Get item details
  SELECT * INTO v_item FROM public.items WHERE id = p_item_id;
  
  -- Check if below threshold
  IF v_item.quantity <= v_item.min_threshold THEN
    -- Create notification for all managers and admins
    FOR v_user IN 
      SELECT p.id 
      FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE r.name IN ('Admin', 'Manager')
    LOOP
      INSERT INTO public.notifications (
        user_id,
        title,
        message,
        priority,
        type,
        reference_id,
        reference_type,
        action_url,
        action_label
      ) VALUES (
        v_user.id,
        'Low Stock Alert',
        'Item "' || v_item.name || '" is below minimum threshold. Current: ' || v_item.quantity || ', Min: ' || v_item.min_threshold,
        'high',
        'stock_alert',
        v_item.id,
        'item',
        '/inventory/items/' || v_item.id,
        'View Item'
      );
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update location path on parent change
CREATE OR REPLACE FUNCTION update_location_path()
RETURNS TRIGGER AS $$
DECLARE
  parent_path TEXT;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.path := '/' || NEW.name;
    NEW.level := 0;
  ELSE
    SELECT path, level INTO parent_path, NEW.level
    FROM public.locations
    WHERE id = NEW.parent_id;
    
    NEW.path := parent_path || '/' || NEW.name;
    NEW.level := NEW.level + 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-generate PO number
CREATE TRIGGER generate_po_number_trigger BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION generate_po_number();

-- Update item quantity on stock movement
CREATE TRIGGER update_item_quantity_trigger AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION update_item_quantity_on_movement();

-- Update location path
CREATE TRIGGER update_location_path_trigger BEFORE INSERT OR UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION update_location_path();

-- Audit trail triggers (for critical tables)
CREATE TRIGGER audit_items_changes AFTER INSERT OR UPDATE OR DELETE ON public.items
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER audit_stock_movements AFTER INSERT OR UPDATE OR DELETE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER audit_purchase_orders AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER audit_roles_changes AFTER UPDATE OR DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_data ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PROFILES POLICIES
-- =====================================================

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.name = 'Admin'
    )
  );

CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.name = 'Admin'
    )
  );

-- =====================================================
-- ROLES POLICIES
-- =====================================================

CREATE POLICY "All authenticated users can view roles"
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage roles"
  ON public.roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.name = 'Admin'
    )
  );

-- =====================================================
-- LOCATIONS POLICIES
-- =====================================================

CREATE POLICY "Authenticated users can view locations"
  ON public.locations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized users can manage locations"
  ON public.locations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
      AND (
        r.permissions @> '["all"]'::jsonb OR
        r.permissions @> '["inventory:write"]'::jsonb
      )
    )
  );

-- =====================================================
-- ITEMS POLICIES
-- =====================================================

CREATE POLICY "Authenticated users can view items"
  ON public.items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized users can modify items"
  ON public.items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
      AND (
        r.permissions @> '["all"]'::jsonb OR
        r.permissions @> '["inventory:write"]'::jsonb
      )
    )
  );

-- =====================================================
-- STOCK_MOVEMENTS POLICIES
-- =====================================================

CREATE POLICY "Authenticated users can view stock movements"
  ON public.stock_movements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized users can create stock movements"
  ON public.stock_movements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
      AND (
        r.permissions @> '["all"]'::jsonb OR
        r.permissions @> '["inventory:write"]'::jsonb
      )
    )
  );

-- =====================================================
-- TASKS POLICIES
-- =====================================================

CREATE POLICY "Users can view assigned tasks"
  ON public.tasks FOR SELECT
  USING (
    assigned_to = auth.uid() OR
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
      AND (
        r.permissions @> '["all"]'::jsonb OR
        r.permissions @> '["tasks:manage"]'::jsonb
      )
    )
  );

CREATE POLICY "Users can update assigned tasks"
  ON public.tasks FOR UPDATE
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

CREATE POLICY "Authorized users can manage all tasks"
  ON public.tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
      AND (
        r.permissions @> '["all"]'::jsonb OR
        r.permissions @> '["tasks:manage"]'::jsonb
      )
    )
  );

-- =====================================================
-- SUPPLIERS POLICIES
-- =====================================================

CREATE POLICY "Authenticated users can view suppliers"
  ON public.suppliers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized users can manage suppliers"
  ON public.suppliers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
      AND (
        r.permissions @> '["all"]'::jsonb OR
        r.permissions @> '["suppliers:manage"]'::jsonb
      )
    )
  );

-- =====================================================
-- PURCHASE_ORDERS POLICIES
-- =====================================================

CREATE POLICY "Authenticated users can view purchase orders"
  ON public.purchase_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized users can manage purchase orders"
  ON public.purchase_orders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid()
      AND (
        r.permissions @> '["all"]'::jsonb OR
        r.permissions @> '["orders:manage"]'::jsonb
      )
    )
  );

-- =====================================================
-- NOTIFICATIONS POLICIES
-- =====================================================

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- AUDIT_LOGS POLICIES
-- =====================================================

CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.name = 'Admin'
    )
  );

CREATE POLICY "System can create audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- REPORTS POLICIES
-- =====================================================

CREATE POLICY "Users can view own reports"
  ON public.reports FOR SELECT
  USING (
    created_by = auth.uid() OR
    is_public = true OR
    auth.uid() = ANY(shared_with)
  );

CREATE POLICY "Users can manage own reports"
  ON public.reports FOR ALL
  USING (created_by = auth.uid());

-- =====================================================
-- FORECAST_DATA POLICIES
-- =====================================================

CREATE POLICY "Authenticated users can view forecast data"
  ON public.forecast_data FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage forecast data"
  ON public.forecast_data FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.name = 'Admin'
    )
  );

-- =====================================================
-- STORAGE BUCKETS (For Supabase Storage)
-- =====================================================

-- Create storage buckets via Supabase Dashboard or API:
-- 1. item-images (public read, authenticated write)
-- 2. documents (private, role-based access)
-- 3. exports (private, user-specific access)

-- =====================================================
-- INITIAL SETUP COMPLETE
-- =====================================================

-- To verify setup, run:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace ORDER BY proname;

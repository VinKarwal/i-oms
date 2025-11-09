# I-OMS Project Guidelines - Final Version

## 📋 Project Overview

**Project Name**: I-OMS (Intelligent Operations Management System)

**Purpose**: Warehouse management and automation system for small to medium businesses

**Tech Stack**: Next.js 14+ (App Router) + Supabase + shadcn/ui + PWA

---

## 🎯 Core Objectives

### Primary Goals
1. **Automate warehouse operations** to minimize manual effort and errors
2. **Enable predictive decision-making** for stock management and replenishment
3. **Simplify task delegation** through intelligent automation
4. **Provide real-time visibility** of stock, sales, and task progress
5. **Build modular, scalable solution** adaptable to different workflows

### Success Criteria
- All core workflows functional end-to-end
- Mobile-first PWA installable on devices
- Real-time updates working (<500ms latency)
- No critical bugs in production
- Performance targets met (Page load <2s, API <200ms)

---

## 🏗️ System Architecture

### Frontend Architecture
````
/app
├── (auth)
│   ├── login
│   └── register
├── (dashboard)
│   ├── admin
│   ├── manager
│   └── staff
├── inventory
│   ├── items
│   ├── locations
│   └── movements
├── tasks
│   ├── kanban
│   ├── list
│   └── calendar
├── orders
│   ├── purchase-orders
│   └── suppliers
├── analytics
│   └── reports
├── notifications
└── settings
    ├── roles
    └── preferences

/components
├── ui (shadcn/ui components)
├── layout
├── forms
├── tables
├── charts
├── scanner (barcode/camera)
└── shared

/lib
├── supabase
│   ├── client.ts
│   ├── server.ts
│   └── middleware.ts
├── utils
├── hooks
└── types

/public
├── icons (PWA)
├── manifest.json
└── sw.js (service worker)
````

### Backend Architecture (Supabase)
````
Database (PostgreSQL)
├── auth.users (Supabase built-in)
├── public.profiles (extends users)
├── public.roles
├── public.permissions
├── public.locations
├── public.items
├── public.stock_movements
├── public.tasks
├── public.suppliers
├── public.purchase_orders
├── public.notifications
├── public.audit_logs
└── public.reports

Storage Buckets
├── item-images
├── documents
└── exports

Row Level Security (RLS)
├── User-based policies
├── Role-based policies
└── Permission-based policies

Realtime Subscriptions
├── stock_movements
├── tasks
├── notifications
└── purchase_orders
````

---

## 🗄️ Database Schema

### 1. profiles (extends auth.users)
````sql
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text,
  role_id uuid references public.roles(id),
  location_id uuid references public.locations(id),
  preferences jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS policies
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);
````

### 2. roles
````sql
create table public.roles (
  id uuid default gen_random_uuid() primary key,
  name text unique not null,
  description text,
  permissions jsonb not null default '[]'::jsonb,
  is_fixed boolean default false, -- Admin, Manager, Staff are fixed
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insert fixed roles
insert into public.roles (name, description, is_fixed, permissions) values
  ('Admin', 'Full system access', true, '["all"]'::jsonb),
  ('Manager', 'Team and inventory management', true, '["inventory:read", "inventory:write", "tasks:manage", "orders:manage", "reports:view"]'::jsonb),
  ('Staff', 'Basic operations', true, '["inventory:read", "tasks:view", "tasks:update"]'::jsonb);
````

### 3. locations
````sql
create table public.locations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null, -- 'warehouse', 'zone', 'aisle', 'shelf', etc.
  parent_id uuid references public.locations(id) on delete cascade,
  path text, -- hierarchical path for easy querying
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index locations_parent_id_idx on public.locations(parent_id);
create index locations_path_idx on public.locations using gin(to_tsvector('english', path));
````

### 4. items
````sql
create table public.items (
  id uuid default gen_random_uuid() primary key,
  sku text unique not null,
  barcode text unique,
  name text not null,
  description text,
  category text,
  unit text not null default 'piece',
  quantity numeric default 0 not null,
  min_threshold numeric,
  max_threshold numeric,
  location_id uuid references public.locations(id),
  cost_price numeric,
  selling_price numeric,
  expiry_date date,
  batch_number text,
  image_url text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index items_sku_idx on public.items(sku);
create index items_barcode_idx on public.items(barcode);
create index items_category_idx on public.items(category);
create index items_location_id_idx on public.items(location_id);
````

### 5. stock_movements
````sql
create type movement_type as enum ('inbound', 'outbound', 'return', 'damage', 'adjustment', 'transfer');

create table public.stock_movements (
  id uuid default gen_random_uuid() primary key,
  item_id uuid references public.items(id) on delete cascade not null,
  type movement_type not null,
  quantity numeric not null,
  from_location_id uuid references public.locations(id),
  to_location_id uuid references public.locations(id),
  reference_id uuid, -- PO id, task id, etc.
  reference_type text, -- 'purchase_order', 'task', 'manual'
  notes text,
  performed_by uuid references auth.users(id) not null,
  performed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index stock_movements_item_id_idx on public.stock_movements(item_id);
create index stock_movements_performed_at_idx on public.stock_movements(performed_at desc);
````

### 6. tasks
````sql
create type task_status as enum ('pending', 'assigned', 'in_progress', 'completed', 'cancelled');
create type task_priority as enum ('critical', 'high', 'medium', 'low');

create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  type text not null, -- 'manual', 'auto-generated', 'recurring'
  status task_status default 'pending' not null,
  priority task_priority default 'medium' not null,
  assigned_to uuid references auth.users(id),
  created_by uuid references auth.users(id) not null,
  due_date timestamp with time zone,
  completed_at timestamp with time zone,
  recurrence_rule text, -- cron-like pattern for recurring tasks
  related_item_id uuid references public.items(id),
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index tasks_assigned_to_idx on public.tasks(assigned_to);
create index tasks_status_idx on public.tasks(status);
create index tasks_due_date_idx on public.tasks(due_date);
````

### 7. suppliers
````sql
create table public.suppliers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  contact_person text,
  email text,
  phone text,
  address text,
  lead_time_days integer default 7,
  payment_terms text,
  rating numeric check (rating >= 0 and rating <= 5),
  on_time_delivery_rate numeric, -- percentage
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
````

### 8. purchase_orders
````sql
create type po_status as enum ('draft', 'requested', 'ordered', 'confirmed', 'in_transit', 'received', 'cancelled');

create table public.purchase_orders (
  id uuid default gen_random_uuid() primary key,
  po_number text unique not null,
  supplier_id uuid references public.suppliers(id) not null,
  status po_status default 'draft' not null,
  items jsonb not null, -- [{item_id, quantity, price}]
  total_amount numeric not null,
  expected_delivery_date date,
  actual_delivery_date date,
  notes text,
  created_by uuid references auth.users(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index purchase_orders_supplier_id_idx on public.purchase_orders(supplier_id);
create index purchase_orders_status_idx on public.purchase_orders(status);
````

### 9. notifications
````sql
create type notification_priority as enum ('critical', 'high', 'medium', 'low');

create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  message text not null,
  priority notification_priority default 'medium' not null,
  type text not null, -- 'stock_alert', 'task_assignment', 'order_update', etc.
  reference_id uuid,
  reference_type text,
  is_read boolean default false,
  read_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index notifications_user_id_idx on public.notifications(user_id);
create index notifications_is_read_idx on public.notifications(is_read);
create index notifications_created_at_idx on public.notifications(created_at desc);
````

### 10. audit_logs
````sql
create table public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  action text not null,
  table_name text not null,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index audit_logs_user_id_idx on public.audit_logs(user_id);
create index audit_logs_table_name_idx on public.audit_logs(table_name);
create index audit_logs_created_at_idx on public.audit_logs(created_at desc);
````

---

## 🔐 Security & RLS Policies

### Example RLS Policies
````sql
-- Items table - all authenticated users can read
create policy "Authenticated users can view items"
  on public.items for select
  to authenticated
  using (true);

-- Only users with inventory:write permission can modify
create policy "Authorized users can modify items"
  on public.items for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      join public.roles r on p.role_id = r.id
      where p.id = auth.uid()
      and (
        r.permissions @> '["all"]'::jsonb
        or r.permissions @> '["inventory:write"]'::jsonb
      )
    )
  );

-- Tasks - users can only see their assigned tasks or tasks they created
create policy "Users can view relevant tasks"
  on public.tasks for select
  to authenticated
  using (
    assigned_to = auth.uid()
    or created_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      join public.roles r on p.role_id = r.id
      where p.id = auth.uid()
      and (
        r.permissions @> '["all"]'::jsonb
        or r.permissions @> '["tasks:manage"]'::jsonb
      )
    )
  );
````

---

## 🎨 UI/UX Standards

### Design System
- **Component Library**: shadcn/ui
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Color Scheme**: Minimal (neutral grays with accent colors)
- **Typography**: System fonts for performance

### Color Palette
````css
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  --secondary: 240 4.8% 95.9%;
  --accent: 240 4.8% 95.9%;
  --destructive: 0 84.2% 60.2%;
  --muted: 240 4.8% 95.9%;
  --border: 240 5.9% 90%;
}

.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  --secondary: 240 3.7% 15.9%;
  --accent: 240 3.7% 15.9%;
  --destructive: 0 62.8% 30.6%;
  --muted: 240 3.7% 15.9%;
  --border: 240 3.7% 15.9%;
}
````

### Component Patterns
- **Forms**: React Hook Form + Zod validation
- **Tables**: TanStack Table with sorting, filtering, pagination
- **Charts**: Recharts for analytics
- **Modals**: Radix UI Dialog
- **Toasts**: Sonner for notifications

---

## 📱 PWA Configuration

### Manifest
````json
{
  "name": "I-OMS - Intelligent Operations Management System",
  "short_name": "I-OMS",
  "description": "Warehouse management and automation system",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["business", "productivity"],
  "screenshots": []
}
````

### Service Worker Features
- Cache-first strategy for static assets
- Network-first for API calls
- Background sync for offline actions
- Camera access for barcode scanning

---

## 🚀 Development Phases

### Phase 1: Foundation & Authentication
**Deliverable**: Users can login and see role-specific dashboard

**Tasks**:
- Initialize Next.js 14 with App Router
- Configure Supabase client
- Set up authentication flow
- Create role-based dashboard layouts
- Implement PWA manifest and service worker
- Set up Vercel deployment

### Phase 2: Core Inventory System
**Deliverable**: Complete inventory control with location tracking

**Tasks**:
- Create database migrations (items, locations, stock_movements)
- Build item CRUD operations
- Implement location hierarchy management
- Add stock movement tracking
- Integrate barcode scanner (camera access)
- Add real-time stock updates

### Phase 3: Task Management & Automation
**Deliverable**: Automated task generation with tracking

**Tasks**:
- Create tasks table and relationships
- Build Kanban/List/Calendar views
- Implement auto-task triggers (low stock, etc.)
- Add round-robin assignment logic
- Create recurring task engine
- Mobile-optimized task interface

### Phase 4: Orders & Supplier Management
**Deliverable**: Complete procurement cycle

**Tasks**:
- Build supplier management system
- Create PO generation (manual + auto)
- Implement supplier portal (separate route)
- Add order receiving workflow
- Integrate partial delivery support
- Link POs to inventory updates

### Phase 5: Notifications & Alerts
**Deliverable**: Real-time notification system

**Tasks**:
- Set up Supabase Realtime subscriptions
- Build notification center UI
- Implement priority-based routing
- Add user preferences
- Create notification triggers

### Phase 6: Analytics & Reporting
**Deliverable**: Data-driven insights with exports

**Tasks**:
- Build dashboard metrics
- Create predefined report templates
- Implement custom report builder
- Add export functionality (PDF, CSV, Excel)
- Integrate data visualization charts

### Phase 7: Audit & Security
**Deliverable**: Complete audit trail and security hardening

**Tasks**:
- Implement comprehensive audit logging
- Review and tighten RLS policies
- Add permission-based UI rendering
- Test security vulnerabilities
- Performance optimization
- Final testing and bug fixes

---

## 🔧 Development Standards

### Code Style
- **Formatting**: Prettier with default config
- **Linting**: ESLint with Next.js recommended rules
- **Naming**: camelCase for variables/functions, PascalCase for components
- **File Structure**: Co-locate related files (component + styles + tests)

### Git Workflow
- **Branches**: `main` (production), `develop` (staging), feature branches
- **Commits**: Conventional commits format
  - `feat: add barcode scanner`
  - `fix: resolve stock calculation bug`
  - `docs: update API documentation`
- **Pull Requests**: Required for all changes to main

### Testing Strategy
- **Unit Tests**: Vitest for utilities and hooks
- **Integration Tests**: For API routes and database operations
- **E2E Tests**: Playwright for critical user flows (optional for MVP)
- **Manual Testing**: Comprehensive checklist before deployment

---

## 📊 Performance Targets

### Metrics
- **Page Load**: <2 seconds (First Contentful Paint)
- **API Response**: <200ms average
- **Real-time Updates**: <500ms latency
- **Lighthouse Score**: >90 (Performance, Accessibility, Best Practices)

### Optimization Strategies
- Server Components by default
- Image optimization with Next.js Image
- Code splitting and lazy loading
- Database query optimization (indexes, joins)
- Caching strategy (SWR/React Query)

---

## 🔮 Post-MVP Features

### Forecast Integration (Week 14-15)
- CSV upload interface
- Data mapping and validation
- Forecast display components
- Forecast-triggered automation
- Accuracy tracking

### Advanced Features
- Multi-tenant architecture
- Advanced analytics (predictive insights)
- Mobile native app (React Native)
- Third-party integrations (accounting, e-commerce)
- API for external systems
- Advanced reporting (custom dashboards)

---

## 📚 Documentation Requirements

### Developer Documentation
- Setup and installation guide
- Database schema documentation
- API reference (if public API exists)
- Component documentation (Storybook optional)

### User Documentation
- Admin guide (role management, settings)
- Manager guide (inventory, tasks, orders)
- Staff guide (task completion, scanning)
- Quick reference cards

---

## ✅ Definition of Done

A feature is considered complete when:
1. Code is written and follows standards
2. Database migrations are created
3. RLS policies are in place
4. UI is responsive and accessible
5. Real-time updates work (if applicable)
6. Manual testing completed
7. Documentation updated
8. Deployed to staging/production

---

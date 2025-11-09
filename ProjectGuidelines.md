# OMS MVP Definition & Development Roadmap

## 🎯 MVP Core Features (Must-Have for Launch)

Based on your requirements, here's the **Minimum Viable Product** scope:

### **Phase 1: Foundation & Authentication** (Week 1-2)
```
✅ User Authentication (Supabase Auth)
   - Email/password login
   - Role assignment (Admin, Manager, Staff)
   - Profile management

✅ Role-Based Access Control (RLS)
   - Fixed: Admin, Manager, Staff
   - Custom roles with permission sets (admin-configurable)
   - Supabase Row Level Security policies

✅ Dashboard Shell
   - Role-specific layouts
   - Navigation structure
   - Responsive design (mobile-first for PWA)
```

**Deliverable**: Users can login and see appropriate dashboard based on role.

---

### **Phase 2: Core Inventory System** (Week 3-5)

```
✅ Inventory Management
   - CRUD operations (Create, Read, Update, Delete items)
   - Custom location hierarchy setup (Warehouse → Custom levels)
   - Item attributes:
     • Basic: SKU, Name, Description, Category
     • Stock: Quantity, Unit
     • Location: Multi-location support
     • Thresholds: Min/Max (user-configurable per item)
     • Metadata: Expiry dates, batch numbers, images
   
✅ Stock Movement Tracking
   - Movement types: Inbound, Outbound, Returns, Damage, Adjustments, Transfers
   - Automatic history logging
   - Real-time stock updates (Supabase Realtime)

✅ Location Management
   - User-defined location structure
   - Visual location hierarchy
   - Stock distribution across locations

✅ Barcode Integration
   - Mobile camera scanning (PWA camera access)
   - Standard formats (EAN-13, UPC, QR codes)
   - Actions: Add stock, Remove stock, Verify location, Quick lookup, Task completion
```

**Deliverable**: Complete inventory control with location tracking and barcode scanning.

---

### **Phase 3: Task Management & Automation** (Week 6-7)

```
✅ Task System
   - Task types: Manual, Auto-generated, Recurring
   - Priority levels: Critical, High, Medium, Low
   - Status workflow: Pending → Assigned → In Progress → Complete
   - Round-robin auto-assignment (configurable)
   - Manual task creation by staff

✅ Auto-Task Triggers
   - Low stock threshold reached
   - [Placeholder] Forecast-based predictions
   - Order received (receiving task)
   - Recurring tasks (daily/weekly/monthly)

✅ Task Views
   - Kanban board
   - List view
   - Calendar view (recurring tasks)
   - Mobile-optimized task completion interface
```

**Deliverable**: Automated task generation with staff assignment and tracking.

---

### **Phase 4: Orders & Supplier Management** (Week 8-9)

```
✅ Supplier Management
   - Supplier directory (contact info, terms, lead times)
   - Performance tracking (on-time delivery, rating)

✅ Purchase Orders
   - Auto-generate from low stock triggers
   - Manual PO creation
   - PO approval workflow (optional)
   - Email PO to suppliers

✅ Supplier Portal (Basic)
   - Unique supplier login link
   - View assigned POs
   - Update order status (Confirmed, In-Transit, Delivered)
   - Upload delivery documents

✅ Order Receiving
   - Automatic inventory update on receipt
   - Manual verification option
   - Partial delivery support
   - Receiving tasks auto-generated
```

**Deliverable**: Complete procurement cycle from PO creation to receiving.

---

### **Phase 5: Notifications & Alerts** (Week 10)

```
✅ In-App Notifications
   - Real-time notifications (Supabase Realtime)
   - Priority-based categorization
   - Notification center with filters
   - Mark as read/unread
   - User-configurable preferences

✅ Alert Types
   - Critical: Stock-out, system errors
   - High: Low stock, delayed orders
   - Medium: Task assignments, updates
   - Low: Completed tasks, info updates

✅ Notification Triggers
   - Stock threshold alerts
   - Task assignments
   - Order status changes
   - System events
```

**Deliverable**: Comprehensive notification system for all user actions.

---

### **Phase 6: Analytics & Reporting** (Week 11-12)

```
✅ Dashboard Analytics
   - Key metrics cards
   - Sales trends (historical data)
   - Inventory status breakdown
   - Task completion rates
   - Recent activities feed

✅ Reports
   - Predefined templates:
     • Daily Summary
     • Stock Valuation
     • Movement History
     • Task Performance
     • Supplier Performance
   - Custom report builder (filter by date, category, location)
   - Export: PDF, CSV, Excel

✅ KPI Tracking
   - Inventory turnover
   - Stock-out frequency
   - Task completion rate
   - Order fulfillment time
   - [Placeholder] Forecast accuracy
```

**Deliverable**: Data-driven insights with exportable reports.

---

### **Phase 7: Audit & Security** (Week 13)

```
✅ Audit Logging
   - Log all actions: inventory changes, user actions, permission changes
   - Immutable audit trail
   - Searchable and filterable logs
   - Export audit reports

✅ Security Features
   - Supabase RLS policies for data isolation
   - Permission-based UI rendering
   - Secure API endpoints
   - Session management
   - Password policies
```

**Deliverable**: Complete audit trail and security compliance.

---

## 📱 PWA Setup (Throughout Development)

```
✅ Progressive Web App Features
   - Install prompt for mobile/desktop
   - Offline-capable (service workers)
   - App manifest (icons, colors, splash screen)
   - Push notifications (optional)
   - Camera access for barcode scanning
   - Responsive design (mobile-first approach)
```

---

## 🔮 Forecast Integration (Post-MVP)

```
🔄 Placeholder Components
   - "Forecast" section in dashboard (shows mock data)
   - "Predicted Demand" field in item details (empty state)
   - "Forecast-based Tasks" toggle (disabled)
   - "Upload Forecast CSV" admin setting (UI only)

📊 Future Integration Points
   - CSV upload endpoint
   - Data mapping (CSV columns → database fields)
   - Forecast display components
   - Forecast-triggered automation rules
```

**Integration Timeline**: Post-MVP, Week 14-15

---

## 🗂️ Database Schema (Supabase Tables)

```sql
-- Core Tables (Priority Order)

1. users (extends Supabase auth.users)
   - Custom fields: role_id, location_id, preferences

2. roles
   - Fixed roles + custom roles
   - Permissions JSON

3. locations
   - Hierarchical structure (parent_id)
   - User-defined levels

4. items (inventory)
   - All item attributes
   - Threshold settings

5. stock_movements
   - All movement types
   - Audit trail

6. tasks
   - Task details, assignments
   - Recurrence rules

7. suppliers
   - Supplier info
   - Performance metrics

8. purchase_orders
   - PO details
   - Status tracking

9. notifications
   - User notifications
   - Preferences

10. audit_logs
    - All system actions
    - Immutable records

11. reports
    - Saved custom reports
    - Templates
```

---

## 🎨 UI Component Library (shadcn/ui)

```
Key Components Needed:
✅ Data Tables (inventory, tasks, orders)
✅ Forms (item creation, task assignment)
✅ Modals/Drawers (item details, quick actions)
✅ Charts (dashboard analytics)
✅ Kanban Board (task management)
✅ Calendar (recurring tasks)
✅ Notifications Panel
✅ Barcode Scanner Component
✅ Camera Access Component
✅ Search & Filters
✅ Export Buttons
✅ Role/Permission Manager
```

---

## 📐 Technical Architecture

```
Frontend (Next.js 14+)
├── App Router
├── Server Components (default)
├── Client Components (interactive UI)
├── API Routes (for CSV processing, reports)
├── Middleware (auth checks)
└── PWA Config (next-pwa)

Backend (Supabase)
├── Authentication (built-in)
├── PostgreSQL Database
├── Row Level Security Policies
├── Real-time Subscriptions
├── Storage (images, documents)
└── Edge Functions (if needed)

State Management
├── React Context (user, notifications)
├── Zustand/Jotai (optional for complex state)
└── React Query/SWR (data fetching)

UI Layer
├── shadcn/ui components
├── Tailwind CSS
├── Radix UI primitives
└── Lucide icons
```

---

## 🚀 Development Workflow

### Week-by-Week Breakdown

**Week 1-2: Setup & Auth**
- Initialize Next.js project with PWA support
- Supabase project setup and schema design
- Authentication flow with role assignment
- Dashboard layouts for all roles

**Week 3-5: Inventory Core**
- Database tables and RLS policies
- CRUD operations for items
- Location management system
- Stock movement tracking
- Barcode scanner integration

**Week 6-7: Task System**
- Task CRUD and workflow
- Auto-task generation rules
- Kanban/List/Calendar views
- Round-robin assignment logic
- Recurring task engine

**Week 8-9: Orders & Suppliers**
- Supplier management
- PO creation and workflow
- Supplier portal (separate app/route)
- Receiving process
- Email integration

**Week 10: Notifications**
- Notification system (Supabase Realtime)
- In-app notification center
- User preferences
- Priority-based routing

**Week 11-12: Analytics**
- Dashboard metrics
- Report templates
- Custom report builder
- Export functionality
- Data visualization

**Week 13: Security & Audit**
- Audit logging system
- Security hardening
- Permission testing
- Penetration testing basics

---

## 📊 MVP Success Metrics

```
Launch Readiness Criteria:
✅ All core workflows functional
✅ No critical bugs
✅ Mobile responsive (PWA installable)
✅ Security audit passed
✅ Documentation complete
✅ User testing completed (5-10 users)
✅ Performance benchmarks met:
   - Page load < 2s
   - API response < 200ms
   - Real-time updates < 500ms latency
```


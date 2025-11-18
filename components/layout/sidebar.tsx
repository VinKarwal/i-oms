'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Package,
  CheckSquare,
  ShoppingCart,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  MapPin,
  ArrowLeftRight,
  Scan,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface SidebarProps {
  role: 'Admin' | 'Manager' | 'Staff'
  mobileOpen?: boolean
  onMobileClose?: () => void
}

const navigationConfig = {
  Admin: [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'User Management', href: '/admin/users', icon: Users },
    { name: 'Locations', href: '/admin/locations', icon: MapPin },
    { name: 'Inventory', href: '/admin/inventory', icon: Package },
    { name: 'Barcode Scanner', href: '/admin/scanner', icon: Scan },
    { name: 'Stock Movements', href: '/admin/stock-movements', icon: ArrowLeftRight },
    { name: 'Tasks', href: '/admin/tasks', icon: CheckSquare },
    { name: 'Orders & Suppliers', href: '/admin/orders', icon: ShoppingCart },
    { name: 'Analytics & Reports', href: '/admin/reports', icon: BarChart3 },
    { name: 'System Settings', href: '/admin/settings', icon: Settings },
  ],
  Manager: [
    { name: 'Dashboard', href: '/manager', icon: LayoutDashboard },
    { name: 'Locations', href: '/manager/locations', icon: MapPin },
    { name: 'Inventory', href: '/manager/inventory', icon: Package },
    { name: 'Barcode Scanner', href: '/manager/scanner', icon: Scan },
    { name: 'Stock Movements', href: '/manager/stock-movements', icon: ArrowLeftRight },
    { name: 'Tasks', href: '/manager/tasks', icon: CheckSquare },
    { name: 'Orders & Suppliers', href: '/manager/orders', icon: ShoppingCart },
    { name: 'Reports', href: '/manager/reports', icon: BarChart3 },
  ],
  Staff: [
    { name: 'Dashboard', href: '/staff', icon: LayoutDashboard },
    { name: 'Inventory', href: '/staff/inventory', icon: Package },
    { name: 'Barcode Scanner', href: '/staff/scanner', icon: Scan },
    { name: 'Stock Movements', href: '/staff/stock-movements', icon: ArrowLeftRight },
    { name: 'My Tasks', href: '/staff/tasks', icon: CheckSquare },
  ],
}

export function Sidebar({ role, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const navigation = navigationConfig[role]

  return (
    <>
      {/* Backdrop for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed md:static inset-y-0 left-0 z-50 flex flex-col bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 transition-transform duration-300',
          // Mobile: slide in/out
          'md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: collapsible width
          'md:transition-all',
          collapsed ? 'md:w-16' : 'md:w-64',
          // Always full width on mobile
          'w-64'
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-stone-200 dark:border-stone-800">
          {!collapsed && (
            <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">I-OMS</h1>
          )}
          
          {/* Desktop collapse button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto hidden md:flex"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>

          {/* Mobile close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onMobileClose}
            className="ml-auto md:hidden"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onMobileClose}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                        : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                    )}
                    title={collapsed ? item.name : undefined}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>
    </>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Package, CheckSquare, Scan } from 'lucide-react'

interface MobileNavProps {
  role: 'Admin' | 'Manager' | 'Staff'
}

const navigationConfig = {
  Admin: [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Inventory', href: '/admin/inventory', icon: Package },
    { name: 'Scanner', href: '/admin/scanner', icon: Scan },
    { name: 'Tasks', href: '/admin/tasks', icon: CheckSquare },
  ],
  Manager: [
    { name: 'Dashboard', href: '/manager', icon: LayoutDashboard },
    { name: 'Inventory', href: '/manager/inventory', icon: Package },
    { name: 'Scanner', href: '/manager/scanner', icon: Scan },
    { name: 'Tasks', href: '/manager/tasks', icon: CheckSquare },
  ],
  Staff: [
    { name: 'Dashboard', href: '/staff', icon: LayoutDashboard },
    { name: 'Inventory', href: '/staff/inventory', icon: Package },
    { name: 'Scanner', href: '/staff/scanner', icon: Scan },
    { name: 'My Tasks', href: '/staff/tasks', icon: CheckSquare },
  ],
}

export function MobileNav({ role }: MobileNavProps) {
  const pathname = usePathname()
  const navigation = navigationConfig[role].slice(0, 5) // Max 5 items for mobile

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800">
      <ul className="flex justify-around items-center h-16">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center h-full gap-1 text-xs font-medium transition-colors',
                  isActive
                    ? 'text-stone-900 dark:text-stone-100'
                    : 'text-stone-500 dark:text-stone-400'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px]">{item.name}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

'use client'

import { ReactNode, useState } from 'react'
import { Sidebar } from './sidebar'
import { TopBar } from './topbar'
import { MobileNav } from './mobile-nav'

interface DashboardLayoutProps {
  children: ReactNode
  user: {
    email: string
    full_name?: string | null
    role?: string | null
  }
  role: 'Admin' | 'Manager' | 'Staff'
}

export function DashboardLayout({ children, user, role }: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar 
        role={role} 
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar 
          user={user} 
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        
        <main className="flex-1 overflow-y-auto bg-stone-50 dark:bg-stone-950 pb-16 md:pb-0">
          {children}
        </main>
      </div>

      <MobileNav role={role} />
    </div>
  )
}

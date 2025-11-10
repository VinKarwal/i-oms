'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { User, LogOut, Settings, Menu } from 'lucide-react'

interface TopBarProps {
  user: {
    email: string
    full_name?: string | null
    role?: string | null
  }
  onMobileMenuToggle?: () => void
}

export function TopBar({ user, onMobileMenuToggle }: TopBarProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = user.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email?.slice(0, 2).toUpperCase()

  return (
    <header className="h-16 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
      <div className="flex items-center justify-between h-full px-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onMobileMenuToggle}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 md:hidden">
            I-OMS
          </h2>
        </div>

        <div className="flex items-center gap-4">
          {user.role && (
            <Badge variant="secondary" className="hidden sm:flex">
              {user.role}
            </Badge>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user.full_name || 'User'}</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">{user.email}</p>
                  {user.role && (
                    <Badge variant="outline" className="w-fit mt-1">
                      {user.role}
                    </Badge>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

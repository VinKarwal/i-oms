'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Clock, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface PendingClientProps {
  userEmail: string
}

export function PendingClient({ userEmail }: PendingClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isChecking, setIsChecking] = useState(false)

  const handleCheckStatus = async () => {
    setIsChecking(true)
    
    // Fetch the latest profile data
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.error('Error fetching user:', userError)
      setIsChecking(false)
      return
    }
    
    if (user) {
      console.log('Checking status for user:', user.id)
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, email, role_id, roles(id, name)')
        .eq('id', user.id)
        .single()

      console.log('Profile query result:', { profile, error })

      if (error) {
        console.error('Error fetching profile:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        setIsChecking(false)
        return
      }

      // If they now have a role, redirect to their dashboard
      if (profile?.role_id && profile.roles) {
        const roles = Array.isArray(profile.roles) ? profile.roles[0] : profile.roles
        const roleName = (roles as { name: string }).name.toLowerCase()
        router.push(`/${roleName}`)
        router.refresh()
      } else {
        // Still no role, just refresh to show updated UI
        setIsChecking(false)
      }
    } else {
      setIsChecking(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
            <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className="text-2xl">Waiting for Role Assignment</CardTitle>
          <CardDescription>
            Your account is pending administrator approval
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              An administrator needs to assign you a role before you can access the system.
              You&apos;ll receive an email notification once your role is assigned.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <p className="text-sm text-stone-600 dark:text-stone-400">
              <strong>Your account:</strong> {userEmail}
            </p>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              <strong>Status:</strong> Pending Role Assignment
            </p>
          </div>

          <div className="pt-4 space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleCheckStatus}
              disabled={isChecking}
            >
              {isChecking ? 'Checking...' : 'Check Status'}
            </Button>
            <Button 
              variant="ghost" 
              className="w-full" 
              onClick={handleSignOut}
            >
              Sign Out
            </Button>
          </div>

          <div className="text-xs text-center text-stone-500 dark:text-stone-400 pt-4">
            If you believe this is an error, please contact your system administrator.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

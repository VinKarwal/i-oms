'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  
  // Listen for auth state changes and redirect
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Redirect to home, middleware will handle role-based routing
        router.push('/')
        router.refresh()
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, router])
  
  // Get the redirect URL, defaulting to a safe value for SSR
  const redirectUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/auth/callback`
    : '/auth/callback'

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-stone-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">I-OMS</CardTitle>
          <CardDescription>
            Sign in to your account to access the Operations Management System
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#000000',
                    brandAccent: '#292524',
                  },
                },
              },
              className: {
                container: 'space-y-4',
                button: 'w-full',
                input: 'w-full',
              },
            }}
            providers={[]}
            redirectTo={redirectUrl}
            onlyThirdPartyProviders={false}
            magicLink={false}
            view="sign_in"
            showLinks={true}
          />
        </CardContent>
      </Card>
    </div>
  )
}

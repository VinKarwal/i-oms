import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes - redirect to login if not authenticated
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If authenticated, check role and redirect appropriately
  if (user) {
    // If trying to access login, redirect based on role
    if (request.nextUrl.pathname.startsWith('/login')) {
      // Fetch user profile with role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role_id, roles(name)')
        .eq('id', user.id)
        .single()

      const url = request.nextUrl.clone()
      
      if (!profile?.role_id) {
        url.pathname = '/pending'
      } else {
        const roleName = (profile.roles as unknown as { name: string })?.name?.toLowerCase() || 'pending'
        url.pathname = `/${roleName}`
      }
      
      return NextResponse.redirect(url)
    }

    // If accessing root or /dashboard, redirect to role-specific dashboard
    if (request.nextUrl.pathname === '/' || request.nextUrl.pathname === '/dashboard') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role_id, roles(name)')
        .eq('id', user.id)
        .single()

      const url = request.nextUrl.clone()
      
      if (!profile?.role_id) {
        url.pathname = '/pending'
      } else {
        const roleName = (profile.roles as unknown as { name: string })?.name?.toLowerCase() || 'pending'
        url.pathname = `/${roleName}`
      }
      
      return NextResponse.redirect(url)
    }

    // Check if user is accessing a role-specific route they're not authorized for
    const roleRoutes = ['/admin', '/manager', '/staff']
    const currentRoleRoute = roleRoutes.find(route => request.nextUrl.pathname.startsWith(route))
    
    if (currentRoleRoute) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role_id, roles(name)')
        .eq('id', user.id)
        .single()

      if (!profile?.role_id) {
        const url = request.nextUrl.clone()
        url.pathname = '/pending'
        return NextResponse.redirect(url)
      }

      const userRoleName = (profile.roles as unknown as { name: string })?.name?.toLowerCase()
      const expectedRole = currentRoleRoute.substring(1) // Remove leading slash

      if (userRoleName !== expectedRole) {
        // User is trying to access a route for a different role
        const url = request.nextUrl.clone()
        url.pathname = `/${userRoleName}`
        return NextResponse.redirect(url)
      }
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}

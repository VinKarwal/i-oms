import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Package, CheckSquare, AlertTriangle } from 'lucide-react'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile with role
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role_id, roles(id, name)')
    .eq('id', user.id)
    .single()

  if (!profile?.role_id) {
    redirect('/pending')
  }

  const roles = Array.isArray(profile.roles) ? profile.roles[0] : profile.roles
  const roleName = roles?.name as 'Admin' | 'Manager' | 'Staff'

  if (roleName !== 'Admin') {
    redirect(`/${roleName.toLowerCase()}`)
  }

  // Fetch dashboard stats
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  const { count: usersWithoutRole } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .is('role_id', null)

  const userData = {
    email: profile.email,
    full_name: profile.full_name,
    role: roleName,
  }

  return (
    <DashboardLayout user={userData} role={roleName}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-stone-600 dark:text-stone-400 mt-2">
            Welcome back, {profile.full_name || user.email}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-stone-600 dark:text-stone-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers || 0}</div>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                Registered users
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Roles</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usersWithoutRole || 0}</div>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                Awaiting assignment
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inventory Items</CardTitle>
              <Package className="h-4 w-4 text-stone-600 dark:text-stone-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                Phase 2 feature
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
              <CheckSquare className="h-4 w-4 text-stone-600 dark:text-stone-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                Phase 3 feature
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common administrative tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <a
                href="/admin/users"
                className="block p-3 rounded-md bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
              >
                <p className="font-medium">Manage Users</p>
                <p className="text-sm text-stone-600 dark:text-stone-400">
                  View and assign user roles
                </p>
              </a>
              <div className="block p-3 rounded-md bg-stone-100 dark:bg-stone-800 opacity-50">
                <p className="font-medium">System Settings</p>
                <p className="text-sm text-stone-600 dark:text-stone-400">Coming soon</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <CardDescription>Current system information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <p className="text-sm">All systems operational</p>
              </div>
              <div className="pt-2">
                <p className="text-sm font-medium">Version</p>
                <p className="text-sm text-stone-600 dark:text-stone-400">1.0.0 (MVP - Phase 1)</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}

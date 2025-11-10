import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, CheckSquare, ShoppingCart, TrendingUp } from 'lucide-react'

export default async function ManagerDashboard() {
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

  if (roleName !== 'Manager') {
    redirect(`/${roleName.toLowerCase()}`)
  }

  const userData = {
    email: profile.email,
    full_name: profile.full_name,
    role: roleName,
  }

  return (
    <DashboardLayout user={userData} role={roleName}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manager Dashboard</h1>
          <p className="text-stone-600 dark:text-stone-400 mt-2">
            Welcome back, {profile.full_name || user.email}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inventory Items</CardTitle>
              <Package className="h-4 w-4 text-stone-600 dark:text-stone-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-stone-600 dark:text-stone-400">Phase 2 feature</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
              <CheckSquare className="h-4 w-4 text-stone-600 dark:text-stone-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-stone-600 dark:text-stone-400">Phase 3 feature</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-stone-600 dark:text-stone-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-stone-600 dark:text-stone-400">Phase 4 feature</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Team Performance</CardTitle>
              <TrendingUp className="h-4 w-4 text-stone-600 dark:text-stone-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-stone-600 dark:text-stone-400">Coming soon</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common management tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="block p-3 rounded-md bg-stone-100 dark:bg-stone-800 opacity-50">
                <p className="font-medium">Manage Inventory</p>
                <p className="text-sm text-stone-600 dark:text-stone-400">Phase 2 - Coming soon</p>
              </div>
              <div className="block p-3 rounded-md bg-stone-100 dark:bg-stone-800 opacity-50">
                <p className="font-medium">Assign Tasks</p>
                <p className="text-sm text-stone-600 dark:text-stone-400">Phase 3 - Coming soon</p>
              </div>
              <div className="block p-3 rounded-md bg-stone-100 dark:bg-stone-800 opacity-50">
                <p className="font-medium">Create Purchase Order</p>
                <p className="text-sm text-stone-600 dark:text-stone-400">Phase 4 - Coming soon</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest updates and changes</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-stone-600 dark:text-stone-400">
                No recent activity to display
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}

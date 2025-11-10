import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckSquare, Package, Scan, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default async function StaffDashboard() {
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

  if (roleName !== 'Staff') {
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
          <h1 className="text-3xl font-bold tracking-tight">Staff Dashboard</h1>
          <p className="text-stone-600 dark:text-stone-400 mt-2">
            Welcome back, {profile.full_name || user.email}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Tasks</CardTitle>
              <CheckSquare className="h-4 w-4 text-stone-600 dark:text-stone-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                Assigned to me
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                Tasks to complete
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
              <CheckSquare className="h-4 w-4 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                Tasks finished
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Items Scanned</CardTitle>
              <Scan className="h-4 w-4 text-stone-600 dark:text-stone-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                Today
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Frequently used operations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" disabled>
                <Scan className="mr-2 h-4 w-4" />
                Scan Barcode
              </Button>
              <Button variant="outline" className="w-full justify-start" disabled>
                <Package className="mr-2 h-4 w-4" />
                View Inventory
              </Button>
              <Button variant="outline" className="w-full justify-start" disabled>
                <CheckSquare className="mr-2 h-4 w-4" />
                My Tasks
              </Button>
              <p className="text-xs text-stone-600 dark:text-stone-400 pt-2">
                Features coming in Phase 2-3
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>My Tasks</CardTitle>
              <CardDescription>Tasks assigned to you</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-stone-600 dark:text-stone-400">
                No tasks assigned yet
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-500 mt-2">
                Task management will be available in Phase 3
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}

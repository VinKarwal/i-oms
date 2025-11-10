import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { UserManagementClient } from './user-management-client'

export default async function UserManagementPage() {
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

  const profileRoles = Array.isArray(profile.roles) ? profile.roles[0] : profile.roles
  const roleName = profileRoles?.name as 'Admin' | 'Manager' | 'Staff'

  if (roleName !== 'Admin') {
    redirect(`/${roleName.toLowerCase()}`)
  }

  // Fetch all users with their roles
  const { data: users } = await supabase
    .from('profiles')
    .select('id, email, full_name, role_id, created_at, updated_at, roles(id, name)')
    .order('created_at', { ascending: false })

  // Fetch all roles
  const { data: roles } = await supabase
    .from('roles')
    .select('*')
    .order('name')

  const userData = {
    email: profile.email,
    full_name: profile.full_name,
    role: roleName,
  }

  return (
    <DashboardLayout user={userData} role={roleName}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-stone-600 dark:text-stone-400 mt-2">
            Manage user accounts and role assignments
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>
              View and manage user roles. Users without roles cannot access the system.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserManagementClient
              initialUsers={users || []}
              roles={roles || []}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

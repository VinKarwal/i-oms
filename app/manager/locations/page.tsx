import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import LocationsClientPage from '../../admin/locations/locations-client'

export default async function ManagerLocationsPage() {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user has permission (Admin or Manager)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role_id, full_name, roles(name)')
    .eq('id', user.id)
    .single()

  const roles = Array.isArray(profile?.roles) ? profile.roles[0] : profile?.roles
  const roleName = roles?.name

  if (roleName !== 'Admin' && roleName !== 'Manager') {
    redirect('/staff') // Redirect staff to their dashboard
  }

  // Fetch locations
  const { data: locations } = await supabase
    .from('locations')
    .select('*')
    .order('path', { ascending: true })

  // Check if setup is needed
  if (!locations || locations.length === 0) {
    redirect('/setup')
  }

  return (
    <DashboardLayout 
      role={roleName as 'Admin' | 'Manager'}
      user={{
        email: user.email || '',
        full_name: profile?.full_name,
        role: roleName
      }}
    >
      <LocationsClientPage initialLocations={locations || []} userRole={roleName} />
    </DashboardLayout>
  )
}

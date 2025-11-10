import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import InventoryClientPage from './inventory-client'

export default async function InventoryPage() {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user has permission
  const { data: profile } = await supabase
    .from('profiles')
    .select('role_id, full_name, roles(name)')
    .eq('id', user.id)
    .single()

  const roles = Array.isArray(profile?.roles) ? profile.roles[0] : profile?.roles
  const roleName = roles?.name

  // Fetch items (let client handle pagination if needed)
  const { data: items } = await supabase
    .from('items')
    .select('*, item_locations(id, location_id, quantity, min_threshold, max_threshold, locations(name, path))')
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(100)

  // Fetch locations for dropdowns
  const { data: locations } = await supabase
    .from('locations')
    .select('*')
    .eq('is_active', true)
    .order('path', { ascending: true })

  // Check if locations exist
  if (!locations || locations.length === 0) {
    redirect('/setup')
  }

  // Calculate total stock for each item
  const itemsWithTotals = items?.map(item => ({
    ...item,
    total_stock: item.item_locations?.reduce((sum: number, il: { quantity: number }) => 
      sum + Number(il.quantity || 0), 0
    ) || 0
  }))

  return (
    <DashboardLayout 
      role={roleName as 'Admin' | 'Manager' | 'Staff'}
      user={{
        email: user.email || '',
        full_name: profile?.full_name,
        role: roleName
      }}
    >
      <InventoryClientPage 
        initialItems={itemsWithTotals || []} 
        locations={locations || []}
        userRole={roleName}
      />
    </DashboardLayout>
  )
}

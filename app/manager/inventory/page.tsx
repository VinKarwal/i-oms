import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InventoryClientPage from '@/app/admin/inventory/inventory-client'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

export const dynamic = 'force-dynamic'

export default async function ManagerInventoryPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!profile || (profile.role !== 'Manager' && profile.role !== 'Admin')) {
    redirect('/unauthorized')
  }

  // Fetch items with item_locations
  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select(`
      *,
      item_locations (
        *,
        locations (*)
      )
    `)
    .eq('is_active', true)
    .order('sku')

  if (itemsError) {
    console.error('Error fetching items:', itemsError)
  }

  // Calculate total stock for each item
  const itemsWithStock = items?.map(item => ({
    ...item,
    total_stock: item.item_locations?.reduce(
      (sum: number, il: { quantity: number }) => sum + Number(il.quantity || 0), 0
    ) || 0
  })) || []

  // Fetch all active locations
  const { data: locations, error: locationsError } = await supabase
    .from('locations')
    .select('*')
    .eq('is_active', true)
    .order('path')

  if (locationsError) {
    console.error('Error fetching locations:', locationsError)
  }

  // Get user profile for full details
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return (
    <DashboardLayout 
      user={{
        email: user.email || '',
        full_name: userProfile?.full_name,
        role: userProfile?.role,
      }}
      role={profile.role as 'Admin' | 'Manager' | 'Staff'}
    >
      <InventoryClientPage
        initialItems={itemsWithStock}
        locations={locations || []}
        userRole={profile.role}
      />
    </DashboardLayout>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import StockMovementsClient from './stock-movements-client'

export const dynamic = 'force-dynamic'

export default async function StockMovementsPage() {
  const supabase = await createClient()

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

  if (!roleName || roleName !== 'Admin') {
    redirect('/login')
  }

  // Fetch recent movements
  const { data: movements } = await supabase
    .from('stock_movements')
    .select(`
      *,
      items (id, sku, name),
      locations (id, name, path)
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(50)

  // Fetch items for filter
  const { data: items } = await supabase
    .from('items')
    .select('id, sku, name')
    .eq('is_active', true)
    .order('name')

  // Fetch locations for filter
  const { data: locations } = await supabase
    .from('locations')
    .select('*')
    .eq('is_active', true)
    .order('path')

  // Fetch pending movements for approval queue (only for Admin/Manager)
  let pendingMovements = []
  if (roleName === 'Admin' || roleName === 'Manager') {
    const { data } = await supabase
      .from('stock_movements')
      .select(`
        *,
        items (id, sku, name),
        locations (id, name, path)
      `)
      .eq('status', 'pending')
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    pendingMovements = data || []
  }

  return (
    <DashboardLayout
      user={{
        email: user.email || '',
        full_name: profile?.full_name,
        role: roleName,
      }}
      role={roleName as 'Admin'}
    >
      <StockMovementsClient
        initialMovements={movements || []}
        pendingMovements={pendingMovements}
        items={items || []}
        locations={locations || []}
        userRole={roleName}
      />
    </DashboardLayout>
  )
}

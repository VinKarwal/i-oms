import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import ScannerClient from './scanner-client'

export const dynamic = 'force-dynamic'

export default async function AdminScannerPage() {
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

  // Fetch items with barcodes
  const { data: items } = await supabase
    .from('items')
    .select('id, sku, barcode, name, unit')
    .eq('is_active', true)
    .order('name')

  // Fetch locations
  const { data: locations } = await supabase
    .from('locations')
    .select('*')
    .eq('is_active', true)
    .order('path')

  return (
    <DashboardLayout
      user={{
        email: user.email || '',
        full_name: profile?.full_name,
        role: roleName,
      }}
      role={roleName as 'Admin'}
    >
      <ScannerClient
        items={items || []}
        locations={locations || []}
        userRole={roleName}
      />
    </DashboardLayout>
  )
}

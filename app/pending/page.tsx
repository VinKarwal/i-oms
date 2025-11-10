import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PendingClient } from './pending-client'

export default async function PendingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user has a role now
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role_id, roles(id, name)')
    .eq('id', user.id)
    .single()

  // If they have a role, redirect to their dashboard
  if (profile?.role_id && profile.roles) {
    const roles = Array.isArray(profile.roles) ? profile.roles[0] : profile.roles
    const roleName = roles?.name as 'Admin' | 'Manager' | 'Staff'
    redirect(`/${roleName.toLowerCase()}`)
  }

  return <PendingClient userEmail={user.email || ''} />
}

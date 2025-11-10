import { redirect } from 'next/navigation'

// This route is deprecated - users are now redirected to role-specific dashboards
// The middleware handles the redirection based on user role
export default function DashboardPage() {
  redirect('/')
}

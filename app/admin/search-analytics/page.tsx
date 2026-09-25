import { redirect } from 'next/navigation'

export default function SearchAnalyticsRedirect() {
  redirect('/admin/analytics?tab=search')
}

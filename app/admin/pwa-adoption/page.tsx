import { redirect } from 'next/navigation'

export default function PwaAdoptionRedirect() {
  redirect('/admin/analytics?tab=app')
}

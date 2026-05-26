import { redirect } from 'next/navigation'

// Ruta deprecada — duplica /partner?tab=my-requests. Mantengo redirect para no
// romper deep-links antiguos / notificaciones.
export default function Page() {
  redirect('/partner?tab=my-requests')
}

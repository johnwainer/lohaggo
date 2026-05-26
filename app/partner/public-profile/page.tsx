import { redirect } from 'next/navigation'

// Ruta deprecada — el editor de perfil público vive ahora en /profile (sección
// "Perfil Público"). Mantengo redirect para no romper enlaces antiguos.
export default function Page() {
  redirect('/profile#perfil-publico')
}

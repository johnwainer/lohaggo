import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Panel Socio - LoHaggo',
  description: 'Gestiona tus solicitudes, reservas, ingresos y perfil profesional en LoHaggo.',
  robots: { index: false, follow: false },
}

// El shell del panel (top bar + sidebar) se aplica en components/PublicLayout.tsx
// para que /profile también lo herede cuando el usuario es PARTNER.
export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

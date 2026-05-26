import { Metadata } from 'next'
import PartnerShell from '@/components/partner/PartnerShell'

export const metadata: Metadata = {
  title: 'Panel Socio - LoHaggo',
  description: 'Gestiona tus solicitudes, reservas, ingresos y perfil profesional en LoHaggo.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PartnerShell>{children}</PartnerShell>
}

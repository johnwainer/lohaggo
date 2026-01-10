import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Únete como Profesional - LoHaggo | Gana Dinero Ofreciendo tus Servicios',
  description: 'Únete a LoHaggo como profesional y aumenta tus ingresos. Conecta con miles de clientes que buscan tus servicios. Registro gratis, sin comisiones ocultas y pagos seguros.',
  openGraph: {
    title: 'Únete a LoHaggo como Profesional - Aumenta tus Ingresos',
    description: 'Regístrate gratis y empieza a recibir solicitudes de clientes cerca de ti. Plomeros, electricistas, carpinteros y más.',
    url: 'https://lohaggo.com/partner',
  },
  alternates: {
    canonical: '/partner',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

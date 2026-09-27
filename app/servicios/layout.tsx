import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Todos los servicios en Medellín',
  description: 'Plomería, electricidad, limpieza, pintura, belleza y más servicios a domicilio en Medellín con profesionales verificados. Pídelo por WhatsApp o búscalo en el catálogo.',
  alternates: { canonical: '/servicios' },
  openGraph: {
    title: 'Todos los servicios en Medellín | LoHaggo',
    description: 'Servicios a domicilio en Medellín con profesionales verificados.',
    url: 'https://www.lohaggo.com/servicios',
  },
}

export default function ServiciosLayout({ children }: { children: React.ReactNode }) {
  return children
}

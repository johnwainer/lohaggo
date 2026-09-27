import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cómo funciona: pide un servicio a domicilio en Medellín',
  description: 'Así funciona LoHaggo: escríbenos por WhatsApp y creamos la solicitud por ti, o búscalo en la web, recibe propuestas de profesionales verificados y paga al terminar.',
  openGraph: {
    title: 'Cómo funciona LoHaggo',
    description: 'Pide tu servicio por WhatsApp o en la web y recibe propuestas de profesionales verificados en Medellín.',
    url: 'https://www.lohaggo.com/how-it-works',
  },
  alternates: {
    canonical: '/how-it-works',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

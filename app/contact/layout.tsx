import { defaultOgImages } from '@/lib/seo/site'
import type { Metadata } from 'next'

const BASE_URL = 'https://www.lohaggo.com'

export const metadata: Metadata = {
  title: 'Contacto',
  description: 'Contáctanos para soporte, alianzas o consultas. Estamos disponibles por WhatsApp, email y redes sociales. LoHaggo – Servicios profesionales en Colombia.',
  keywords: [
    'contacto LoHaggo',
    'soporte LoHaggo',
    'ayuda servicios Colombia',
    'WhatsApp LoHaggo',
    'email LoHaggo',
    'alianzas LoHaggo',
  ],
  alternates: { canonical: `${BASE_URL}/contact` },
  openGraph: {
    title: 'Contacto – LoHaggo',
    description: 'Contáctanos para soporte, alianzas o consultas. Disponibles por WhatsApp, email y redes sociales.',
    url: `${BASE_URL}/contact`,
    siteName: 'LoHaggo',
    locale: 'es_CO',
    type: 'website',
    images: defaultOgImages('Contacto LoHaggo'),
  },
  twitter: {
    card: 'summary',
    title: 'Contacto – LoHaggo',
    description: 'Contáctanos por WhatsApp, email o redes sociales. LoHaggo – Servicios profesionales en Colombia.',
    creator: '@lohaggo',
  },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

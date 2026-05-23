import { Suspense } from 'react'
import { Metadata } from 'next'
import HomeClientWrapper from '@/components/HomeClientWrapper'
import { ServiciosContent } from './servicios/page'
import { HomeActiveBookingsBanner } from '@/components/client/HomeActiveBookingsBanner'
import { HomePublicTestimonials } from '@/components/client/HomePublicTestimonials'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'LoHaggo – Contrata Servicios Profesionales en Medellín | Plomeros, Electricistas y Más',
  description: 'LoHaggo: contrata plomeros, electricistas, limpieza, carpinteros, jardineros y más en Medellín. Profesionales verificados con precios transparentes. ¡Reserva en minutos y paga al finalizar!',
  keywords: [
    // Marca y variaciones
    'LoHaggo', 'Lo Haggo', 'lohaggo', 'lo haggo', 'lo hago', 'lohago', 'lohaggo.com',
    // Servicios Medellín
    'plomero Medellín', 'electricista Medellín', 'limpieza hogar Medellín',
    'carpintero Medellín', 'pintor Medellín', 'jardinero Medellín',
    'cerrajero Medellín', 'fumigación Medellín', 'reparaciones hogar Medellín',
    // Categorías
    'servicios a domicilio Medellín', 'servicios profesionales Colombia',
    'contratar servicios del hogar', 'profesionales verificados Colombia',
    'mantenimiento hogar Medellín', 'expertos verificados Medellín',
  ],
  openGraph: {
    title: 'LoHaggo - Servicios Profesionales en Colombia',
    description: 'Contrata servicios profesionales en Colombia: plomeros, electricistas, limpieza y más. Expertos verificados en Medellín con precios transparentes.',
    url: 'https://www.lohaggo.com',
    siteName: 'LoHaggo',
    locale: 'es_CO',
    type: 'website',
  },
  alternates: {
    canonical: 'https://www.lohaggo.com',
  },
}

const homePageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'LoHaggo – Servicios Profesionales en Medellín',
  url: 'https://www.lohaggo.com',
  description: 'Contrata plomeros, electricistas, limpieza y más en Medellín. Profesionales verificados con LoHaggo.',
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://www.lohaggo.com' },
    ],
  },
}

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homePageSchema) }}
      />
      <HomeClientWrapper>
        <div className="min-h-screen bg-slate-50">
          <HomeActiveBookingsBanner />

          <Suspense
            fallback={
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent" />
              </div>
            }
          >
            <ServiciosContent showHeading={false} />
          </Suspense>

          <HomePublicTestimonials />
        </div>
      </HomeClientWrapper>
    </>
  )
}

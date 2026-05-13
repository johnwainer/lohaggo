import { Suspense } from 'react'
import { Metadata } from 'next'
import { Star } from 'lucide-react'
import Link from 'next/link'
import HomeClientWrapper from '@/components/HomeClientWrapper'
import { ServiciosContent } from './servicios/page'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'LoHaggo - Servicios Profesionales en Colombia | Plomeros, Electricistas y Más',
  description: 'Contrata servicios profesionales en Colombia: plomeros, electricistas, limpieza, carpinteros, jardineros y más. Expertos verificados en Medellín con precios transparentes. ¡Reserva en minutos!',
  keywords: [
    'servicios a domicilio Colombia',
    'servicios profesionales Medellín',
    'contratar plomero Medellín',
    'electricista Medellín',
    'carpintero profesional',
    'servicio de limpieza',
    'jardinería Medellín',
    'reparaciones del hogar',
    'profesionales verificados',
    'servicios del hogar Colombia',
    'mantenimiento del hogar',
    'lohaggo',
    'expertos verificados Colombia'
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

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'LoHaggo',
  url: 'https://www.lohaggo.com',
  logo: 'https://www.lohaggo.com/icon-512.png',
  description: 'Plataforma de servicios profesionales en Colombia. Conectamos clientes con profesionales verificados en Medellín.',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Medellín',
    addressRegion: 'Antioquia',
    addressCountry: 'CO'
  },
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'hola@lohaggo.com',
    contactType: 'customer service',
    availableLanguage: 'Spanish'
  },
  sameAs: [
    'https://www.facebook.com/lohaggo',
    'https://www.instagram.com/lohaggo_'
  ]
}

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'LoHaggo',
  url: 'https://www.lohaggo.com',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://www.lohaggo.com/?search={search_term_string}',
    'query-input': 'required name=search_term_string'
  }
}

const testimonials = [
  {
    text: 'Contraté un plomero y llegó en menos de 2 horas. Muy profesional y el precio fue justo.',
    name: 'María González',
    initial: 'M',
  },
  {
    text: 'La mejor plataforma para encontrar servicios. Rápida, confiable y con excelentes profesionales.',
    name: 'Juan Pérez',
    initial: 'J',
  },
  {
    text: 'El electricista que contraté fue muy profesional y resolvió mi problema rápidamente.',
    name: 'Ana Martínez',
    initial: 'A',
  },
]

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <HomeClientWrapper>
      <div className="min-h-screen bg-gray-50">
        {/* Service browser */}
        <Suspense
          fallback={
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent" />
            </div>
          }
        >
          <ServiciosContent showHeading={false} />
        </Suspense>

        {/* Social proof — al fondo, fuera del flujo de compra */}
        <section className="py-12 bg-gray-50 border-t border-gray-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-black text-gray-900 mb-6 text-center">Lo que dicen nuestros clientes</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {testimonials.map((t) => (
                <div key={t.name} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-700 text-sm mb-4 leading-relaxed">"{t.text}"</p>
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {t.initial}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-gray-900">{t.name}</div>
                      <div className="text-xs text-gray-400">Cliente verificado</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      </HomeClientWrapper>
    </>
  )
}

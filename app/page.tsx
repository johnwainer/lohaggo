import { Suspense } from 'react'
import { Metadata } from 'next'
import HomeClientWrapper from '@/components/HomeClientWrapper'
import { HomeCatalog } from '@/components/home/HomeCatalog'
import { HomeActiveBookingsBanner } from '@/components/client/HomeActiveBookingsBanner'
import { HomePublicTestimonials } from '@/components/client/HomePublicTestimonials'
import { HomeFeaturedPartners } from '@/components/client/HomeFeaturedPartners'
import { HomeHeroCTA } from '@/components/client/HomeHeroCTA'
import { queryServices } from '@/lib/services/queryServices'
import { prisma } from '@/lib/prisma'
import { getPublicTrustSafe, publicContactExtras, realTestimonials } from '@/lib/public/trust'
import { STAT_MINIMUMS } from '@/lib/public/claims'

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

export default async function Home() {
  // Server-render the default (Medellín) catalogue so the first paint already
  // contains real service cards — no client fetch chain, no spinner, no shift.
  // Failures degrade gracefully to the client-side fetch path.
  const [initialResult, initialCategories, trust] = await Promise.all([
    queryServices({ citySlug: 'medellin' }).catch(() => undefined),
    prisma.category
      .findMany({
        include: { _count: { select: { services: true } } },
        orderBy: { name: 'asc' },
      })
      .catch(() => undefined),
    getPublicTrustSafe(),
  ])
  const [testimonials, contact] = await Promise.all([
    trust.claims.trust_real_testimonials ? realTestimonials(6).catch(() => []) : Promise.resolve([]),
    publicContactExtras(trust.claims),
  ])

  // Real reviews only, above the minimum; nothing is claimed if the database is unreachable
  const rating = trust.stats.rating
  const trustSchema =
    rating || trust.claims.trust_support_247
      ? {
          '@context': 'https://schema.org',
          '@type': 'LocalBusiness',
          '@id': 'https://www.lohaggo.com/#localbusiness',
          name: 'LoHaggo',
          url: 'https://www.lohaggo.com',
          ...(trust.claims.trust_support_247
            ? {
                openingHoursSpecification: {
                  '@type': 'OpeningHoursSpecification',
                  dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
                  opens: '00:00',
                  closes: '23:59',
                },
              }
            : {}),
          ...(rating
            ? {
                aggregateRating: {
                  '@type': 'AggregateRating',
                  ratingValue: rating.value.toFixed(1),
                  reviewCount: rating.reviews.toString(),
                  bestRating: '5',
                  worstRating: '1',
                },
              }
            : {}),
        }
      : null

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homePageSchema) }}
      />
      {trustSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(trustSchema) }}
        />
      )}
      <HomeClientWrapper>
        <div className="min-h-screen bg-slate-50">
          <HomeActiveBookingsBanner />
          <HomeHeroCTA showGuarantee={trust.claims.trust_guarantee} whatsappPhone={contact.whatsappPhone} />

          <HomeCatalog
            services={(initialResult?.services ?? []) as any}
            categories={(initialCategories ?? []) as any}
            interleaveSlot={<Suspense fallback={null}><HomeFeaturedPartners /></Suspense>}
            whatsappPhone={contact.whatsappPhone}
            limit={8}
          />

          {testimonials.length >= STAT_MINIMUMS.testimonials && (
            <HomePublicTestimonials testimonials={testimonials} />
          )}
        </div>
      </HomeClientWrapper>
    </>
  )
}

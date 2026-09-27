import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { getPublicTrustSafe } from '@/lib/public/trust'
import { STAT_MINIMUMS } from '@/lib/public/claims'
import { citiesLine, clientPayment, verificationLong, verificationShort } from '@/lib/public/copy'

type Props = { params: Promise<{ slug: string }>; children: React.ReactNode }

const BASE_URL = 'https://www.lohaggo.com'

// Map service icon emoji / name → schema type
function getServiceSchemaType(name: string, category: string): string {
  const n = name.toLowerCase()
  const c = category.toLowerCase()
  if (c.includes('plo') || n.includes('plo') || n.includes('agua') || n.includes('tube')) return 'PlumbingService'
  if (c.includes('elec') || n.includes('elec')) return 'ElectricalContractor'
  if (c.includes('limp') || n.includes('limp') || n.includes('aseo')) return 'HouseCleaning'
  if (c.includes('pint') || n.includes('pint')) return 'PaintingContractor'
  if (c.includes('carp') || n.includes('carp') || n.includes('mader')) return 'Carpenter'
  if (c.includes('jard') || n.includes('jard') || n.includes('poda')) return 'LandscapingBusiness'
  if (c.includes('segur') || n.includes('segur') || n.includes('cerraj')) return 'Locksmith'
  return 'HomeAndConstructionBusiness'
}

function buildKeywords(name: string, category: string): string[] {
  const base = [
    `${name.toLowerCase()} en Medellín`,
    `${name.toLowerCase()} Colombia`,
    `contratar ${name.toLowerCase()}`,
    `${name.toLowerCase()} a domicilio`,
    `${name.toLowerCase()} verificado`,
    `servicio de ${name.toLowerCase()}`,
    `${category.toLowerCase()} Medellín`,
    'servicios profesionales Colombia',
    'LoHaggo',
  ]
  return base
}

/** Verified, active partners offering the service, and the rating from their real reviews of it. */
const serviceTrust = cache(async (serviceId: string) => {
  const partnerWhere = { verified: true, isActive: true }
  const [verifiedPartners, rating] = await Promise.all([
    prisma.partnerService.count({ where: { serviceId, active: true, partner: partnerWhere } }),
    prisma.review.aggregate({
      where: { clientToPartnerRating: { not: null }, booking: { serviceId, partner: partnerWhere } },
      _avg: { clientToPartnerRating: true },
      _count: { clientToPartnerRating: true },
    }),
  ])
  const reviews = rating._count.clientToPartnerRating
  const avg = rating._avg.clientToPartnerRating
  return {
    verifiedPartners,
    rating: avg && reviews >= STAT_MINIMUMS.reviewsForRating ? { value: (Math.round(avg * 10) / 10).toFixed(1), reviews } : null,
  }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params

  const service = await prisma.service.findUnique({
    where: { slug },
    select: {
      name: true,
      description: true,
      id: true,
      icon: true,
      basePrice: true,
      category: { select: { name: true } },
    },
  })

  if (!service) return notFound()

  const { verifiedPartners } = await serviceTrust(service.id).catch(() => ({ verifiedPartners: 0 }))

  const title = verifiedPartners > 0 ? `${service.name} en Medellín – Profesionales Verificados` : `${service.name} en Medellín – Próximamente en LoHaggo`
  const description = `Contrata ${service.name.toLowerCase()} en Medellín con LoHaggo. ${service.description}${verifiedPartners > 0 ? ` ${verifiedPartners} profesionales verificados disponibles.` : ''} Precios desde $${Math.round(service.basePrice).toLocaleString('es-CO')}. Reserva fácil y paga al terminar.`
  const url = `${BASE_URL}/servicios/${slug}`

  return {
    title,
    description,
    keywords: buildKeywords(service.name, service.category.name),
    alternates: { canonical: url },
    robots: verifiedPartners > 0 ? undefined : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url,
      siteName: 'LoHaggo',
      locale: 'es_CO',
      type: 'website',
      images: [{ url: `${BASE_URL}/icon-512.png`, width: 512, height: 512, alt: `${service.name} – LoHaggo` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      creator: '@lohaggo',
    },
  }
}

export default async function ServiceSlugLayout({ params, children }: Props) {
  const { slug } = await params

  const service = await prisma.service.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      description: true,
      basePrice: true,
      category: { select: { name: true } },
    },
  })

  if (!service) return <>{children}</>

  const [{ verifiedPartners, rating }, trust] = await Promise.all([
    serviceTrust(service.id).catch(() => ({ verifiedPartners: 0, rating: null })),
    getPublicTrustSafe(),
  ])
  // Real ratings only, and only when the public stats switch is on
  const shownRating = trust.claims.trust_real_stats ? rating : null
  const coverage = citiesLine(trust)

  const schemaType = getServiceSchemaType(service.name, service.category.name)
  const url = `${BASE_URL}/servicios/${slug}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': schemaType === 'HomeAndConstructionBusiness' ? 'LocalBusiness' : [schemaType, 'LocalBusiness'],
    name: `${service.name} en Medellín – LoHaggo`,
    description: service.description,
    url,
    provider: {
      '@type': 'Organization',
      name: 'LoHaggo',
      url: BASE_URL,
      logo: `${BASE_URL}/icon-512.png`,
    },
    areaServed: {
      '@type': 'City',
      name: 'Medellín',
      containedIn: { '@type': 'Country', name: 'Colombia' },
    },
    offers: {
      '@type': 'Offer',
      price: service.basePrice,
      priceCurrency: 'COP',
      availability: 'https://schema.org/InStock',
      url,
    },
    aggregateRating: shownRating ? {
      '@type': 'AggregateRating',
      ratingValue: shownRating.value,
      reviewCount: shownRating.reviews.toString(),
      bestRating: '5',
      worstRating: '1',
    } : undefined,
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: BASE_URL },
        { '@type': 'ListItem', position: 2, name: 'Servicios', item: `${BASE_URL}/servicios` },
        { '@type': 'ListItem', position: 3, name: service.name, item: url },
      ],
    },
  }

  const priceFormatted = Math.round(service.basePrice).toLocaleString('es-CO')

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/*
        Server-rendered SEO header — visible to Google crawlers and users during hydration.
        Provides real text content so the page is never seen as a Soft 404.
        This section renders server-side before any client JS runs.
      */}
      <section
        style={{
          background: 'linear-gradient(135deg, #0066CC 0%, #0052a3 100%)',
          color: 'white',
          padding: '2rem 1.5rem 1.5rem',
        }}
        aria-label={`Información sobre ${service.name}`}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <p style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {service.category.name} · Medellín, Colombia
          </p>
          <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 800, marginBottom: '0.75rem', lineHeight: 1.2 }}>
            {service.name} en Medellín
          </h1>
          <p style={{ fontSize: '0.95rem', opacity: 0.9, marginBottom: '1.25rem', maxWidth: '600px', lineHeight: 1.5 }}>
            {service.description}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.85rem' }}>
            {shownRating && (
              <span style={{ background: 'rgba(255,255,255,0.15)', padding: '0.35rem 0.75rem', borderRadius: '999px' }}>
                ⭐ {shownRating.value}/5 · {shownRating.reviews} reseñas
              </span>
            )}
            {verifiedPartners > 0 && (
              <span style={{ background: 'rgba(255,255,255,0.15)', padding: '0.35rem 0.75rem', borderRadius: '999px' }}>
                👷 {verifiedPartners} profesionales verificados
              </span>
            )}
            <span style={{ background: 'rgba(255,255,255,0.15)', padding: '0.35rem 0.75rem', borderRadius: '999px' }}>
              💰 Desde ${priceFormatted} COP
            </span>
          </div>
        </div>
      </section>
      {children}
      {/* Rich server-rendered content block — ensures Google never sees a thin page */}
      <section style={{ background: '#f9fafb', borderTop: '1px solid #e5e7eb', padding: '2.5rem 1.5rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', marginBottom: '1rem' }}>
            ¿Por qué contratar {service.name.toLowerCase()} con LoHaggo?
          </h2>
          <p style={{ color: '#374151', lineHeight: 1.7, marginBottom: '1.5rem' }}>
            En LoHaggo conectamos a clientes con profesionales de {service.name.toLowerCase()}.
            {' '}{verificationLong(trust)}
            {shownRating ? ' Las calificaciones que ves vienen de reseñas de reservas completadas.' : ''}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {[
              { icon: '✅', title: 'Profesionales verificados', desc: trust.claims.trust_background_check ? verificationShort(trust) : 'Identidad verificada por nuestro equipo' },
              { icon: '💰', title: 'Precio transparente', desc: `Desde $${Math.round(service.basePrice).toLocaleString('es-CO')} COP` },
              ...(shownRating ? [{ icon: '⭐', title: `${shownRating.value}/5 calificación`, desc: `Basada en ${shownRating.reviews} reseñas reales` }] : []),
              { icon: '📅', title: 'Reserva en línea', desc: 'Sin llamadas ni esperas innecesarias' },
              { icon: '🔒', title: trust.claims.trust_online_payment_protection ? 'Pago protegido' : 'Pagas al terminar', desc: clientPayment(trust) },
              ...(coverage ? [{ icon: '📍', title: 'Cobertura', desc: coverage }] : []),
            ].map(item => (
              <div key={item.title} style={{ background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{item.icon}</div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827', marginBottom: '0.25rem' }}>{item.title}</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{item.desc}</div>
              </div>
            ))}
          </div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', marginBottom: '0.75rem' }}>
            Sobre el servicio de {service.name.toLowerCase()} en Medellín
          </h2>
          <p style={{ color: '#374151', lineHeight: 1.7, marginBottom: '1rem' }}>
            {service.description}
            {verifiedPartners > 0 ? ` Contamos con ${verifiedPartners} profesionales verificados en la categoría ${service.category.name}.` : ''}
            {' '}Puedes reservar en línea y agendar para el día que prefieras.
          </p>
          <p style={{ color: '#374151', lineHeight: 1.7 }}>
            LoHaggo es una plataforma de servicios profesionales en Colombia. {verificationLong(trust)}
            {shownRating ? ' Las calificaciones son 100 % de clientes reales que ya usaron el servicio.' : ''}
          </p>
        </div>
      </section>
    </>
  )
}

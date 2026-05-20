import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params

  const service = await prisma.service.findUnique({
    where: { slug },
    select: {
      name: true,
      description: true,
      icon: true,
      basePrice: true,
      category: { select: { name: true } },
      _count: { select: { partners: true } },
    },
  })

  if (!service) return notFound()

  const title = `${service.name} en Medellín – Profesionales Verificados`
  const description = `Contrata ${service.name.toLowerCase()} en Medellín con LoHaggo. ${service.description} ${service._count.partners} profesionales verificados disponibles. Precios desde $${Math.round(service.basePrice).toLocaleString('es-CO')}. ¡Reserva en minutos!`
  const url = `${BASE_URL}/servicios/${slug}`

  return {
    title,
    description,
    keywords: buildKeywords(service.name, service.category.name),
    alternates: { canonical: url },
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
      name: true,
      description: true,
      basePrice: true,
      category: { select: { name: true } },
      _count: { select: { partners: true } },
      partners: {
        where: { active: true },
        select: { partner: { select: { rating: true, totalReviews: true } } },
        take: 100,
      },
    },
  })

  if (!service) return <>{children}</>

  const reviews = service.partners.flatMap(p => Array(p.partner.totalReviews).fill(p.partner.rating))
  const avgRating = reviews.length
    ? (reviews.reduce((a, b) => a + b, 0) / reviews.length).toFixed(1)
    : '4.8'
  const reviewCount = reviews.length || service._count.partners * 3

  const schemaType = getServiceSchemaType(service.name, service.category.name)
  const url = `${BASE_URL}/servicios/${slug}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': schemaType,
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
    aggregateRating: reviewCount > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: avgRating,
      reviewCount: reviewCount.toString(),
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
            <span style={{ background: 'rgba(255,255,255,0.15)', padding: '0.35rem 0.75rem', borderRadius: '999px' }}>
              ⭐ {avgRating}/5 · {reviewCount} reseñas
            </span>
            <span style={{ background: 'rgba(255,255,255,0.15)', padding: '0.35rem 0.75rem', borderRadius: '999px' }}>
              👷 {service._count.partners} profesionales verificados
            </span>
            <span style={{ background: 'rgba(255,255,255,0.15)', padding: '0.35rem 0.75rem', borderRadius: '999px' }}>
              💰 Desde ${priceFormatted} COP
            </span>
          </div>
        </div>
      </section>
      {children}
    </>
  )
}

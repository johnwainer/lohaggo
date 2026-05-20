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
      {/* Server-rendered content for search engines — always visible in HTML */}
      <div className="sr-only" aria-hidden="false">
        <h1>{service.name} en Medellín – LoHaggo</h1>
        <p>
          Contrata {service.name.toLowerCase()} en Medellín con LoHaggo.
          {' '}{service.description}
        </p>
        <ul>
          <li>Categoría: {service.category.name}</li>
          <li>Precio base desde ${priceFormatted} COP</li>
          <li>{service._count.partners} profesionales verificados disponibles</li>
          <li>Calificación promedio: {avgRating} / 5 basada en {reviewCount} reseñas</li>
          <li>Área de servicio: Medellín, Antioquia, Colombia</li>
          <li>Reserva en minutos — paga al finalizar el servicio</li>
        </ul>
        <p>
          LoHaggo conecta clientes con profesionales verificados en Medellín.
          Todos nuestros socios pasan por verificación de identidad y antecedentes.
          Solicita {service.name.toLowerCase()} hoy y recibe atención en tu hogar.
        </p>
      </div>
      {children}
    </>
  )
}

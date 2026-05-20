import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'

type Props = { params: Promise<{ slug: string }>; children: React.ReactNode }

const BASE_URL = 'https://www.lohaggo.com'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params

  const city = await prisma.cityConfig.findUnique({
    where: { slug },
    select: { name: true, slug: true, status: true },
  })

  const cityName = city?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1)
  const isActive = city?.status === 'ACTIVE'
  const url = `${BASE_URL}/ciudad/${slug}`

  const title = isActive
    ? `Servicios Profesionales en ${cityName} – LoHaggo`
    : `LoHaggo llega pronto a ${cityName} – Regístrate`
  const description = isActive
    ? `Contrata plomeros, electricistas, limpieza y más en ${cityName}. Profesionales verificados con precios transparentes. ¡Reserva en minutos con LoHaggo!`
    : `LoHaggo está llegando a ${cityName}. Regístrate para ser de los primeros en acceder a servicios profesionales verificados en tu ciudad.`

  return {
    title,
    description,
    keywords: [
      `servicios en ${cityName}`,
      `profesionales en ${cityName}`,
      `plomero ${cityName}`,
      `electricista ${cityName}`,
      `limpieza ${cityName}`,
      `servicios a domicilio ${cityName}`,
      `LoHaggo ${cityName}`,
      'servicios profesionales Colombia',
    ],
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'LoHaggo',
      locale: 'es_CO',
      type: 'website',
      images: [{ url: `${BASE_URL}/icon-512.png`, width: 512, height: 512, alt: `LoHaggo ${cityName}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      creator: '@lohaggo',
    },
  }
}

export default async function CitySlugLayout({ params, children }: Props) {
  const { slug } = await params

  const city = await prisma.cityConfig.findUnique({
    where: { slug },
    select: { name: true, slug: true, latitude: true, longitude: true, status: true },
  })

  const cityName = city?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1)
  const url = `${BASE_URL}/ciudad/${slug}`

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Servicios Profesionales en ${cityName} – LoHaggo`,
    url,
    description: `Contrata plomeros, electricistas, limpieza y más en ${cityName} con LoHaggo.`,
    provider: {
      '@type': 'Organization',
      name: 'LoHaggo',
      url: BASE_URL,
      logo: `${BASE_URL}/icon-512.png`,
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: BASE_URL },
        { '@type': 'ListItem', position: 2, name: cityName, item: url },
      ],
    },
  }

  if (city?.latitude && city?.longitude) {
    jsonLd.spatialCoverage = {
      '@type': 'Place',
      name: cityName,
      geo: { '@type': 'GeoCoordinates', latitude: city.latitude, longitude: city.longitude },
      containedInPlace: { '@type': 'Country', name: 'Colombia' },
    }
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  )
}

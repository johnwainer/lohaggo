import type { Metadata } from 'next'
import { loadCity } from '@/lib/seo/city'
import { cityIsIndexable } from '@/lib/seo/indexing'
import { defaultOgImages, SITE_URL as BASE_URL } from '@/lib/seo/site'

type Props = { params: Promise<{ slug: string }>; children: React.ReactNode }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const city = await loadCity(slug)
  if (!city) return { title: 'Ciudad no encontrada', robots: { index: false, follow: true } }

  const cityName = city.name
  const isActive = cityIsIndexable(city.status)
  const url = `${BASE_URL}/ciudad/${slug}`

  // The root layout's title template adds « | LoHaggo»
  const title = isActive ? `Servicios a domicilio en ${cityName}` : `LoHaggo llega pronto a ${cityName}`
  const description = isActive
    ? `Contrata plomeros, electricistas, limpieza y más en ${cityName}. Profesionales verificados que te envían propuestas con precio. Pide en línea o por WhatsApp.`
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
    // Coming-soon cities show their content to people but stay out of Google until they open
    robots: isActive ? undefined : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url,
      siteName: 'LoHaggo',
      locale: 'es_CO',
      type: 'website',
      images: defaultOgImages(`LoHaggo ${cityName}`),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: defaultOgImages().map((i) => i.url),
      creator: '@lohaggo',
    },
  }
}

export default async function CitySlugLayout({ params, children }: Props) {
  const { slug } = await params
  const city = await loadCity(slug)
  if (!city) return <>{children}</>

  const cityName = city.name
  const url = `${BASE_URL}/ciudad/${slug}`
  const isActive = cityIsIndexable(city.status)

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: isActive ? `Servicios a domicilio en ${cityName}` : `LoHaggo llega pronto a ${cityName}`,
    url,
    description: isActive
      ? `Contrata plomeros, electricistas, limpieza y más en ${cityName} con LoHaggo.`
      : `LoHaggo está llegando a ${cityName}.`,
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

  if (city.latitude && city.longitude) {
    jsonLd.spatialCoverage = {
      '@type': 'Place',
      name: cityName,
      geo: { '@type': 'GeoCoordinates', latitude: city.latitude, longitude: city.longitude },
      containedInPlace: { '@type': 'Country', name: 'Colombia' },
    }
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      {children}
    </>
  )
}

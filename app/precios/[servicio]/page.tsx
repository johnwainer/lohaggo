import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { getPricesSafe, PRICE_PAGE_LIMIT } from '@/lib/seo/data'
import { priceLabel } from '@/lib/seo/prices'
import { defaultOgImages, pesosCO, SITE_URL } from '@/lib/seo/site'
import { jsonLdScript } from '@/lib/marketing/seo'
import { faqJsonLd, focusZones, isFocusService, serviceZonePath, type FaqItem } from '@/lib/public/serviceZones'
import { FaqList, ZoneLinks } from '@/components/public/ServiceSeoBlocks'

export const revalidate = 86400

type Props = { params: Promise<{ servicio: string }> }

const load = cache(async (slug: string) => {
  const data = await getPricesSafe()
  const item = data?.items.slice(0, PRICE_PAGE_LIMIT).find((s) => s.slug === slug)
  return data && item ? { item, updatedAt: data.updatedAt } : null
})

const fmtDate = (d: Date) => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(d)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { servicio } = await params
  const r = await load(servicio)
  if (!r) return { title: 'Precio no disponible', robots: { index: false, follow: true } }
  const name = r.item.name
  const title = `¿Cuánto cuesta ${name.toLowerCase()} en Medellín?`
  const description = r.item.info.source === 'proposals'
    ? `Precio de ${name.toLowerCase()} en Medellín: entre ${pesosCO(r.item.info.low)} y ${pesosCO(r.item.info.high)} COP según propuestas reales de socios verificados. Qué cambia el valor y cómo pedirlo.`
    : `Precio de ${name.toLowerCase()} en Medellín: desde ${pesosCO(r.item.info.from)} COP. Cada socio verificado envía su propuesta y tú eliges. Qué cambia el valor y cómo pedirlo.`
  const url = `${SITE_URL}/precios/${servicio}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} | LoHaggo`, description, url, siteName: 'LoHaggo', locale: 'es_CO', type: 'article', images: defaultOgImages(`Precio de ${name} en Medellín`) },
    twitter: { card: 'summary_large_image', title, description, images: defaultOgImages().map((i) => i.url) },
  }
}

export default async function PrecioServicioPage({ params }: Props) {
  const { servicio } = await params
  const r = await load(servicio)
  if (!r) notFound()
  const { item: s, updatedAt } = r
  const name = s.name.toLowerCase()
  const info = s.info

  const faq: FaqItem[] = [
    {
      q: `¿Cuánto cuesta ${name} en Medellín?`,
      a: info.source === 'proposals'
        ? `El rango típico es de ${pesosCO(info.low)} a ${pesosCO(info.high)} COP (mediana ${pesosCO(info.median)}), calculado con ${info.sample} propuestas reales de socios verificados de LoHaggo en los últimos 12 meses. El precio base del catálogo parte desde ${pesosCO(s.from)} COP.`
        : `El servicio de ${name} en LoHaggo parte desde ${pesosCO(info.from)} COP. Todavía no hay suficientes propuestas para afirmar un rango típico; cada socio te envía su propuesta con precio.`,
    },
    {
      q: `¿Qué hace que el precio de ${name} cambie?`,
      a: 'El tipo y la complejidad del trabajo, los materiales, el tiempo que toma, la zona y si es urgente. Por eso cada socio envía su propuesta y tú puedes comparar antes de confirmar.',
    },
    {
      q: '¿Cómo pago?',
      a: 'El precio lo acuerdas con el socio en su propuesta, antes de confirmar. Los medios de pago disponibles se muestran al reservar.',
    },
  ]

  const zoneLinks = isFocusService(s.slug) ? focusZones().map((z) => ({ href: serviceZonePath(s.slug, z.key), label: `${s.name} en ${z.name}` })) : []
  const jsonLd = [
    faqJsonLd(faq),
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Precios', item: `${SITE_URL}/precios` },
        { '@type': 'ListItem', position: 3, name: s.name, item: `${SITE_URL}/precios/${s.slug}` },
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-white pb-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <article className="mx-auto max-w-3xl px-4 pt-8 sm:pt-12">
        <nav aria-label="Ruta" className="text-sm text-gray-500">
          <Link href="/" className="hover:text-primary-700">Inicio</Link> <span aria-hidden>›</span>{' '}
          <Link href="/precios" className="hover:text-primary-700">Precios</Link> <span aria-hidden>›</span> {s.name}
        </nav>
        <h1 className="mt-4 text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">¿Cuánto cuesta {name} en Medellín?</h1>

        <div className="mt-6 rounded-3xl border border-primary-100 bg-primary-50 p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">
            {info.source === 'proposals' ? 'Rango típico' : 'Precio base'}
          </p>
          <p className="mt-1 text-3xl font-extrabold text-gray-900">{priceLabel(info)}</p>
          <p className="mt-2 text-sm text-gray-600">
            {info.source === 'proposals'
              ? `Calculado con ${info.sample} propuestas reales de socios verificados en los últimos 12 meses. Mediana: ${pesosCO(info.median)} COP.`
              : 'Es el precio base del catálogo; aún no hay suficientes propuestas para mostrar un rango típico.'}
            {' '}Actualizado el {fmtDate(updatedAt)}.
          </p>
        </div>

        <h2 className="mt-8 text-xl font-bold text-gray-900">Qué cambia el valor</h2>
        <ul className="mt-3 list-disc space-y-1 pl-6 leading-7 text-gray-700">
          <li>El tipo de trabajo y su complejidad.</li>
          <li>Los materiales y repuestos que haga falta comprar.</li>
          <li>El tiempo que toma y si lo necesitas con urgencia.</li>
          <li>La zona donde se hace el servicio.</li>
        </ul>
        <p className="mt-4 leading-7 text-gray-700">
          Es una referencia, no una tarifa fija: cada socio verificado te envía su propuesta con precio y fecha, y tú eliges antes de confirmar.
        </p>

        <div className="mt-8 rounded-3xl bg-gradient-to-br from-primary-600 to-secondary-500 p-6 text-white">
          <p className="text-lg font-bold">Pide {name} y compara propuestas</p>
          <p className="mt-1 text-sm text-white/90">Cuéntanos qué necesitas y recibe el precio de cada socio.</p>
          <Link href={`/servicios/${s.slug}`} className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-full bg-white px-6 text-base font-bold text-primary-700 hover:bg-white/90">
            Ver {s.name}
          </Link>
        </div>

        <ZoneLinks title={`${s.name} por zona`} links={zoneLinks} />
        <FaqList items={faq} title={`Preguntas frecuentes sobre el precio de ${name}`} />
      </article>
    </div>
  )
}

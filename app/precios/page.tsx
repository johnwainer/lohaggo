import type { Metadata } from 'next'
import Link from 'next/link'
import { getPricesSafe, PRICE_PAGE_LIMIT } from '@/lib/seo/data'
import { priceLabel } from '@/lib/seo/prices'
import { defaultOgImages, SITE_URL } from '@/lib/seo/site'
import { jsonLdScript } from '@/lib/marketing/seo'
import { faqJsonLd, type FaqItem } from '@/lib/public/serviceZones'
import { FaqList } from '@/components/public/ServiceSeoBlocks'

export const revalidate = 86400

const TITLE = 'Precios de servicios a domicilio en Medellín'
const DESCRIPTION = 'Cuánto cuesta un plomero, un electricista, la limpieza o una pintura en Medellín: rangos de referencia calculados con propuestas reales de socios verificados de LoHaggo.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/precios` },
  openGraph: { title: `${TITLE} | LoHaggo`, description: DESCRIPTION, url: `${SITE_URL}/precios`, siteName: 'LoHaggo', locale: 'es_CO', type: 'website', images: defaultOgImages() },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: defaultOgImages().map((i) => i.url) },
}

const fmtDate = (d: Date) => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(d)

const FAQ: FaqItem[] = [
  {
    q: '¿De dónde salen estos precios?',
    a: 'Cuando hay suficientes propuestas, el rango sale de los precios reales que los socios de LoHaggo enviaron a clientes en los últimos 12 meses (se descartan los extremos). Cuando todavía no hay suficientes, mostramos solo el precio base «desde» del catálogo.',
  },
  {
    q: '¿Es el precio final que voy a pagar?',
    a: 'No. Es una referencia. El valor final depende del trabajo, los materiales y la zona: cada socio te envía su propuesta con precio y tú eliges antes de confirmar.',
  },
  {
    q: '¿Cada cuánto se actualizan?',
    a: 'Cada día se recalculan con las propuestas más recientes.',
  },
]

export default async function PreciosPage() {
  const data = await getPricesSafe()
  const items = data?.items.slice(0, PRICE_PAGE_LIMIT) ?? []

  const jsonLd = [
    faqJsonLd(FAQ),
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Precios', item: `${SITE_URL}/precios` },
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-white pb-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <div className="mx-auto max-w-3xl px-4 pt-8 sm:pt-12">
        <nav aria-label="Ruta" className="text-sm text-gray-500">
          <Link href="/" className="hover:text-primary-700">Inicio</Link> <span aria-hidden>›</span> Precios
        </nav>
        <h1 className="mt-4 text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">Precios de servicios a domicilio en Medellín</h1>
        <p className="mt-3 leading-7 text-gray-700">
          Una referencia para saber cuánto puede costar cada servicio antes de pedirlo. Son valores en pesos colombianos (COP) y el
          precio final lo define el socio según tu trabajo.
          {data && <> Actualizado el {fmtDate(data.updatedAt)}.</>}
        </p>

        {items.length > 0 ? (
          <ul className="mt-8 divide-y divide-gray-100 rounded-3xl border border-gray-100 bg-white shadow-sm">
            {items.map((s) => (
              <li key={s.slug}>
                <Link href={`/precios/${s.slug}`} className="flex min-h-[64px] items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50">
                  <span>
                    <span className="block font-semibold text-gray-900">{s.name}</span>
                    <span className="block text-xs text-gray-500">
                      {s.info.source === 'proposals' ? `Rango típico · ${s.info.sample} propuestas reales` : 'Precio base del catálogo'}
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-bold text-primary-700">{priceLabel(s.info)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-8 rounded-2xl bg-gray-50 p-5 text-gray-600">Estamos actualizando los precios. Mientras tanto puedes ver el <Link href="/servicios" className="font-semibold text-primary-700 underline">catálogo de servicios</Link>.</p>
        )}

        <div className="mt-8 rounded-3xl bg-gradient-to-br from-primary-600 to-secondary-500 p-6 text-white">
          <p className="text-lg font-bold">¿Quieres un precio para tu caso?</p>
          <p className="mt-1 text-sm text-white/90">Pide el servicio y recibe propuestas de socios verificados con precio y fecha. Comparas y eliges.</p>
          <Link href="/servicios" className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-full bg-white px-6 text-base font-bold text-primary-700 hover:bg-white/90">
            Ver todos los servicios
          </Link>
        </div>

        <FaqList items={FAQ} title="Preguntas frecuentes sobre los precios" />
      </div>
    </div>
  )
}

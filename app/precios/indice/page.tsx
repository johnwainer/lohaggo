import type { Metadata } from 'next'
import Link from 'next/link'
import { getPriceIndexSafe } from '@/lib/seo/data'
import { changeLabel, WINDOW_DAYS } from '@/lib/seo/price-index-core'
import { defaultOgImages, pesosCO, SITE_URL } from '@/lib/seo/site'
import { jsonLdScript } from '@/lib/marketing/seo'
import { faqJsonLd, type FaqItem } from '@/lib/public/serviceZones'
import { FaqList } from '@/components/public/ServiceSeoBlocks'

export const revalidate = 86400

const TITLE = 'Índice de precios del hogar en Medellín'
const DESCRIPTION = 'Cuánto cuestan los servicios a domicilio en Medellín y cómo cambiaron en los últimos 90 días: mediana por servicio calculada con propuestas reales de socios verificados. Datos descargables.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/precios/indice` },
  openGraph: { title: `${TITLE} | LoHaggo`, description: DESCRIPTION, url: `${SITE_URL}/precios/indice`, siteName: 'LoHaggo', locale: 'es_CO', type: 'article', images: defaultOgImages(TITLE) },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: defaultOgImages().map((i) => i.url) },
}

const fmtDate = (iso: string) => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(new Date(iso))

const FAQ: FaqItem[] = [
  { q: '¿Cómo se calcula el índice?', a: `Para cada servicio tomamos los precios de las propuestas que los socios verificados de LoHaggo enviaron a clientes en los últimos ${WINDOW_DAYS} días y mostramos la mediana y el rango típico (se descartan los extremos). La variación compara esa mediana con la de los ${WINDOW_DAYS} días anteriores.` },
  { q: '¿Por qué algunos servicios no aparecen?', a: 'Un servicio solo entra cuando tiene suficientes propuestas de varios socios distintos. Preferimos no publicar una cifra antes que publicar una que no sea confiable.' },
  { q: '¿Es el precio que voy a pagar?', a: 'Es una referencia. El valor final depende del trabajo, los materiales, la zona y la urgencia: cada socio te envía su propuesta con precio y tú eliges antes de confirmar.' },
  { q: '¿Puedo usar estos datos?', a: 'Sí. Puedes descargarlos en CSV y citarlos mencionando a LoHaggo y la fecha de actualización.' },
]

const arrow = (t: 'up' | 'down' | 'stable' | null) => (t === 'up' ? '▲' : t === 'down' ? '▼' : t === 'stable' ? '■' : '–')
const tone = (t: 'up' | 'down' | 'stable' | null) => (t === 'up' ? 'text-red-700' : t === 'down' ? 'text-green-700' : 'text-gray-500')

export default async function PriceIndexPage() {
  const idx = await getPriceIndexSafe()

  const jsonLd: object[] = [
    faqJsonLd(FAQ),
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Precios', item: `${SITE_URL}/precios` },
      { '@type': 'ListItem', position: 3, name: 'Índice de precios del hogar', item: `${SITE_URL}/precios/indice` },
    ] },
  ]
  if (idx && idx.rows.length > 0) {
    jsonLd.push({
      '@context': 'https://schema.org', '@type': 'Dataset',
      name: TITLE, description: DESCRIPTION, url: `${SITE_URL}/precios/indice`, inLanguage: 'es-CO',
      creator: { '@type': 'Organization', name: 'LoHaggo', url: SITE_URL },
      dateModified: idx.updatedAt, temporalCoverage: `${idx.from}/${idx.to}`,
      spatialCoverage: { '@type': 'Place', name: 'Medellín, Antioquia, Colombia' },
      variableMeasured: ['Precio mediano en COP', 'Variación porcentual a 90 días'],
      distribution: { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${SITE_URL}/precios/indice/datos.csv` },
    })
  }

  return (
    <div className="min-h-screen bg-white pb-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <article className="mx-auto max-w-3xl px-4 pt-8 sm:pt-12">
        <nav aria-label="Ruta" className="text-sm text-gray-500">
          <Link href="/" className="hover:text-primary-700">Inicio</Link> <span aria-hidden>›</span> <Link href="/precios" className="hover:text-primary-700">Precios</Link> <span aria-hidden>›</span> Índice
        </nav>
        <h1 className="mt-4 text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">{TITLE}</h1>

        {!idx || idx.rows.length === 0 ? (
          <p className="mt-6 rounded-2xl bg-gray-50 p-5 text-gray-600">Estamos reuniendo suficientes propuestas para publicar el índice. Mientras tanto mira los <Link href="/precios" className="font-semibold text-primary-700 underline">precios de referencia por servicio</Link>.</p>
        ) : (
          <>
            <p className="mt-4 text-lg font-medium leading-8 text-gray-900">
              {idx.overallChangePct !== null
                ? <>En los últimos {WINDOW_DAYS} días los precios de los servicios a domicilio en Medellín {changeLabel(idx.overallChangePct) === 'estable' ? 'se mantuvieron estables' : `${changeLabel(idx.overallChangePct)} en la mediana`}. De {idx.comparable} servicios comparables, {idx.up} subieron, {idx.down} bajaron y {idx.stable} siguen estables.</>
                : <>Estos son los precios medianos de {idx.rows.length} servicios a domicilio en Medellín según propuestas reales de socios verificados.</>}
            </p>
            <p className="mt-2 text-sm text-gray-500">Datos del {fmtDate(idx.from)} al {fmtDate(idx.to)} · {idx.sample.toLocaleString('es-CO')} propuestas · actualizado el {fmtDate(idx.updatedAt)}</p>

            <div className="mt-6 overflow-hidden rounded-3xl border border-gray-100 shadow-sm">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Precio mediano y variación a 90 días por servicio en Medellín</caption>
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr><th scope="col" className="px-4 py-3">Servicio</th><th scope="col" className="px-4 py-3 text-right">Mediana</th><th scope="col" className="px-4 py-3 text-right">{WINDOW_DAYS} días</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {idx.rows.map((r) => (
                    <tr key={r.slug}>
                      <td className="px-4 py-3">
                        <Link href={`/precios/${r.slug}`} className="font-semibold text-gray-900 hover:text-primary-700">{r.name}</Link>
                        <span className="block text-xs text-gray-500">Rango típico {pesosCO(r.low)} a {pesosCO(r.high)} · {r.sample} propuestas</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{pesosCO(r.median)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${tone(r.trend)}`}><span aria-hidden>{arrow(r.trend)}</span> {r.changePct === null ? 'sin dato' : `${r.changePct > 0 ? '+' : ''}${r.changePct.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-gray-500">Una variación puede reflejar un cambio en el tipo de trabajos pedidos y no solo en el precio. Los cambios mayores a 60 % se muestran pero no entran al índice general.</p>

            <Link href="/precios/indice/datos.csv" className="mt-4 inline-flex min-h-[44px] items-center rounded-full border border-primary-200 px-5 text-sm font-semibold text-primary-700 hover:bg-primary-50">Descargar los datos (CSV)</Link>
          </>
        )}

        <div className="mt-8 rounded-3xl bg-gradient-to-br from-primary-600 to-secondary-500 p-6 text-white">
          <p className="text-lg font-bold">¿Quieres el precio para tu caso?</p>
          <p className="mt-1 text-sm text-white/90">Pide el servicio y compara las propuestas de socios verificados.</p>
          <Link href="/servicios" className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-full bg-white px-6 text-base font-bold text-primary-700 hover:bg-white/90">Ver servicios</Link>
        </div>

        <FaqList items={FAQ} title="Preguntas frecuentes sobre el índice" />
      </article>
    </div>
  )
}

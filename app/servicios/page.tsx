import { Suspense } from 'react'
import Link from 'next/link'
import { ServiciosContent } from '@/components/services/ServiciosContent'
import { getCatalogSafe, groupByCategory } from '@/lib/seo/data'
import { jsonLdScript } from '@/lib/marketing/seo'
import { SITE_URL, pesosCO } from '@/lib/seo/site'

export const revalidate = 3600

export default async function ServiciosPage() {
  const groups = groupByCategory(await getCatalogSafe())
  const all = groups.flatMap((g) => g.services)

  const jsonLd = all.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Servicios a domicilio en Medellín',
        itemListElement: all.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.name, url: `${SITE_URL}/servicios/${s.slug}` })),
      }
    : null

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />}
      <div className="bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 md:pt-8">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black mb-2 md:mb-3 text-gray-900">Todos los servicios</h1>
          <p className="text-gray-600 text-base md:text-lg font-medium">
            Servicios a domicilio en Medellín con profesionales verificados. Elige uno, recibe propuestas con precio y compara.
          </p>
        </div>
      </div>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
          </div>
        }
      >
        <ServiciosContent headingRenderedByServer />
      </Suspense>

      {groups.length > 0 && (
        <section aria-labelledby="catalogo-completo" className="border-t border-gray-100 bg-white px-4 py-10">
          <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
            <h2 id="catalogo-completo" className="text-2xl font-bold text-gray-900">Catálogo completo por categoría</h2>
            <p className="mt-2 text-gray-600">
              Todos los servicios de LoHaggo con su precio base. ¿Quieres una referencia más real? Mira los{' '}
              <Link href="/precios" className="font-semibold text-primary-700 underline">precios típicos por servicio</Link>.
            </p>
            <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((g) => (
                <div key={g.slug}>
                  <h3 className="text-lg font-bold text-gray-900">{g.name}</h3>
                  <ul className="mt-3 space-y-2">
                    {g.services.map((s) => (
                      <li key={s.slug}>
                        <Link href={`/servicios/${s.slug}`} className="flex items-baseline justify-between gap-3 rounded-xl px-3 py-2 hover:bg-gray-50">
                          <span className="font-medium text-gray-800">{s.name}</span>
                          <span className="shrink-0 text-sm text-gray-500">desde {pesosCO(s.from)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}

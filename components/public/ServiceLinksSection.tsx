import Link from 'next/link'
import { reviewedPartnersOfService } from '@/lib/seo/data'
import { guidesForService } from '@/lib/seo/guides'
import { RemoteImage } from '@/components/ui/RemoteImage'

/**
 * Enlaces internos de una página de servicio: «Socios de X» (perfiles públicos con al menos una reseña)
 * y las guías del blog sobre el servicio. Componente de servidor; nunca rompe la página si la consulta falla.
 */
export async function ServiceLinksSection({ serviceId, serviceName }: { serviceId: string; serviceName: string }) {
  const [partners, guides] = await Promise.all([
    reviewedPartnersOfService(serviceId, 6).catch(() => []),
    guidesForService(serviceName, 3).catch(() => []),
  ])
  if (!partners.length && !guides.length) return null
  const name = serviceName.toLowerCase()

  return (
    <section className="border-t border-gray-100 bg-white px-4 pb-10 pt-2" aria-label={`Socios y guías de ${name}`}>
      <div className="mx-auto max-w-3xl">
        {partners.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-900">Socios de {name}</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {partners.map((p) => {
                const display = p.isCompany && p.companyName ? p.companyName : p.user.name ?? 'Socio LoHaggo'
                return (
                  <li key={p.slug}>
                    <Link href={`/pro/${p.slug}`} className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm hover:border-primary-200">
                      {p.user.image ? (
                        <RemoteImage src={p.user.image} alt={display} width={48} height={48} className="h-12 w-12 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100 font-bold text-primary-700">
                          {display.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-gray-900">{display}</span>
                        <span className="block text-sm text-gray-600">
                          {p.rating.toFixed(1)}★ · {p.totalReviews} {p.totalReviews === 1 ? 'reseña' : 'reseñas'}
                        </span>
                        {p.profileHeadline && <span className="block truncate text-xs text-gray-500">{p.profileHeadline}</span>}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        {guides.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-900">Guías sobre {name}</h2>
            <ul className="mt-4 space-y-2">
              {guides.map((g) => (
                <li key={g.slug}>
                  <Link href={`/blog/${g.slug}`} className="font-semibold text-primary-700 underline underline-offset-2">{g.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

import Link from 'next/link'
import { CountBadge } from '@/components/ui/count-badge'
import type { ReactNode } from 'react'
import { ChevronRight, SlidersHorizontal } from 'lucide-react'
import { ServiceCardView, type ServiceCardData } from '@/components/services/ServiceCardView'
import {
  FavoriteHeart,
  FavoritesProvider,
  HomeCatalogCityGate,
  HomeCategoryGrid,
  HomeSearchForm,
  type HomeCategory,
} from './HomeCatalogClient'

const available = (s: ServiceCardData) => s.partnerStats?.availableCount ?? s._count.partners

/**
 * Home catalogue rendered on the server (search, categories and the top services as links),
 * so the home does not ship the whole /servicios client bundle. Searching or picking a
 * category continues on /servicios.
 */
export function HomeCatalog({
  services,
  categories,
  interleaveSlot,
  whatsappPhone,
  limit,
}: {
  services: ServiceCardData[]
  categories: HomeCategory[]
  interleaveSlot?: ReactNode
  whatsappPhone: string | null
  limit: number
}) {
  // Same default view as /servicios: only services with partners (LoHaggo Ya always), most available first
  const listed = services
    .filter((s) => s.slug === 'lohaggo-ya' || available(s) > 0)
    .sort((a, b) => available(b) - available(a) || a.name.localeCompare(b.name, 'es'))
  const featured = listed.find((s) => s.slug === 'lohaggo-ya')
  const ordered = featured ? [featured, ...listed.filter((s) => s.id !== featured.id)] : listed

  const activeSlugs = new Set(services.filter((s) => available(s) > 0).map((s) => s.category.slug))
  const shownCategories = categories.filter((c) => activeSlugs.size === 0 || activeSlugs.has(c.slug))

  const catalog = (
    <>
      <div id="buscar" className="scroll-mt-24 bg-white rounded-2xl md:rounded-3xl shadow-card p-4 md:p-6 mb-4 md:mb-6 border border-slate-100 transition">
        <div className="flex flex-col md:flex-row gap-4">
          <HomeSearchForm examples={services.map((s) => s.name)} />
        </div>
        <HomeCategoryGrid
          categories={shownCategories.map(({ id, name, slug, icon }) => ({ id, name, slug, icon }))}
        />
      </div>

      <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-3 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-gray-800 md:text-base">
            {listed.length} {listed.length === 1 ? 'servicio' : 'servicios'}
          </p>
          <Link
            href="/servicios"
            className="hidden md:inline-flex items-center gap-2 rounded-full bg-primary-600 px-3.5 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary-700"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtrar resultados
            <CountBadge count={0} showZero tone="glass" />
          </Link>
        </div>
      </div>

      <FavoritesProvider>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6" data-tour="services-grid">
          {ordered.slice(0, limit).map((service) => (
            <ServiceCardView key={service.id} service={service} favoriteSlot={<FavoriteHeart serviceId={service.id} />} />
          ))}
        </div>
      </FavoritesProvider>

      {ordered.length > limit && (
        <div className="mt-4 flex justify-center">
          <Link
            href="/servicios"
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-full border border-primary-200 bg-white px-6 text-base font-bold text-primary-700 shadow-sm hover:bg-primary-50 sm:w-auto"
          >
            Ver todos los servicios ({ordered.length})
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </>
  )

  return (
    <HomeCatalogCityGate
      catalog={services.length > 0 ? catalog : null}
      interleaveSlot={interleaveSlot}
      whatsappPhone={whatsappPhone}
      homeLimit={limit}
    />
  )
}

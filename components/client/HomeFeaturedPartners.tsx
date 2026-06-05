import { getFeaturedPartners } from '@/lib/featured-partners'
import { FeaturedPartnerCard } from './FeaturedPartnerCard'

export async function HomeFeaturedPartners() {
  const partners = await getFeaturedPartners()

  if (partners.length < 2) return null

  return (
    <section className="py-10 bg-white border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 text-center sm:text-left">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
            Contratas a personas reales
          </h2>
          <p className="text-sm text-slate-500">
            Profesionales verificados que viven cerca de ti.
          </p>
        </div>

        <div className="flex md:hidden gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {partners.map((p) => (
            <div key={p.slug} className="flex-shrink-0 w-[260px]">
              <FeaturedPartnerCard partner={p} />
            </div>
          ))}
        </div>

        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {partners.map((p) => (
            <FeaturedPartnerCard key={p.slug} partner={p} />
          ))}
        </div>
      </div>
    </section>
  )
}

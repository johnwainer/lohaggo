import { getFeaturedPartners } from '@/lib/featured-partners'
import { FeaturedPartnerCard } from './FeaturedPartnerCard'
import { ChevronDown } from 'lucide-react'

export async function HomeFeaturedPartners() {
  const partners = await getFeaturedPartners()

  if (partners.length < 2) return null

  return (
    <section className="my-6 md:my-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-4 text-center sm:text-left">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
            Contratas a personas reales
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Profesionales verificados que viven cerca de ti.
          </p>
        </div>

        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {partners.map((p) => (
            <div
              key={p.slug}
              className="flex-shrink-0 snap-start w-[280px] md:w-[calc(33.333%-0.5rem)]"
            >
              <FeaturedPartnerCard partner={p} />
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-center">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            Sigue explorando servicios
            <ChevronDown className="w-3.5 h-3.5 animate-bounce" />
          </span>
        </div>
      </div>
    </section>
  )
}

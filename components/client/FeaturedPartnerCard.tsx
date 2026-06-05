import Link from 'next/link'
import { CheckCircle, Star, ChevronRight } from 'lucide-react'
import type { FeaturedPartner } from '@/lib/featured-partners'

const CITY_NAMES: Record<string, string> = {
  MEDELLIN: 'Medellín',
  BOGOTA: 'Bogotá',
  CALI: 'Cali',
  BARRANQUILLA: 'Barranquilla',
}

export function FeaturedPartnerCard({ partner }: { partner: FeaturedPartner }) {
  const visibleServices = partner.services.slice(0, 2)
  const extraServices = Math.max(0, partner.services.length - visibleServices.length)
  const showRating = partner.totalReviews >= 3
  const initials = partner.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <Link
      href={`/pro/${partner.slug}`}
      className="group flex items-center gap-3 bg-white rounded-2xl p-3 shadow-card border border-slate-100 hover:shadow-lg hover:border-primary-200 transition-all snap-start min-w-[280px] md:min-w-0"
    >
      <div className="relative flex-shrink-0">
        {partner.image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={partner.image}
            alt={partner.name}
            loading="lazy"
            className="w-14 h-14 rounded-full object-cover border border-white shadow-sm"
          />
        ) : (
          <div
            className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 text-white flex items-center justify-center text-lg font-bold border border-white shadow-sm"
            aria-hidden="true"
          >
            {initials}
          </div>
        )}
        <span
          className="absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center bg-emerald-500 text-white rounded-full p-0.5 border-2 border-white"
          aria-label="Socio verificado"
        >
          <CheckCircle className="w-3 h-3" />
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-slate-900 text-sm leading-tight truncate">
          {partner.name}
        </h3>

        <div className="flex flex-wrap gap-1 mt-1">
          {visibleServices.map((s) => (
            <span
              key={s.slug}
              className="inline-block bg-primary-50 text-primary-700 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
            >
              {s.name}
            </span>
          ))}
          {extraServices > 0 && (
            <span className="inline-block bg-slate-100 text-slate-600 text-[10px] font-medium px-1.5 py-0.5 rounded-full">
              +{extraServices}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
          {showRating ? (
            <span className="inline-flex items-center gap-0.5 text-slate-700 font-medium">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              {partner.rating.toFixed(1)}
              <span className="text-slate-400 font-normal">({partner.totalReviews})</span>
            </span>
          ) : (
            <span className="text-emerald-600 font-medium">Nuevo</span>
          )}
          <span className="text-slate-300">·</span>
          <span className="truncate">{CITY_NAMES[partner.city] ?? partner.city}</span>
        </div>
      </div>

      <ChevronRight className="flex-shrink-0 w-4 h-4 text-slate-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all" />
    </Link>
  )
}

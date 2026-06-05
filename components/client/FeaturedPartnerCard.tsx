import Link from 'next/link'
import { CheckCircle, Star, ArrowRight } from 'lucide-react'
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

  return (
    <Link
      href={`/pro/${partner.slug}`}
      className="group block bg-white rounded-2xl p-5 shadow-card border border-slate-100 hover:shadow-lg hover:border-primary-200 transition-all snap-start min-w-[260px] md:min-w-0 h-full"
    >
      <div className="flex flex-col items-center text-center h-full">
        <div className="relative mb-3">
          {partner.image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={partner.image}
              alt={partner.name}
              loading="lazy"
              className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-md"
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 text-white flex items-center justify-center text-2xl font-bold border-2 border-white shadow-md"
              aria-hidden="true"
            >
              {partner.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </div>
          )}
          <span
            className="absolute -bottom-1 -right-1 inline-flex items-center justify-center bg-emerald-500 text-white rounded-full p-1 border-2 border-white"
            aria-label="Socio verificado"
          >
            <CheckCircle className="w-3.5 h-3.5" />
          </span>
        </div>

        <h3 className="font-semibold text-slate-900 text-sm leading-tight mb-1 line-clamp-1">
          {partner.name}
        </h3>

        {partner.profileHeadline && (
          <p className="text-xs text-slate-500 line-clamp-1 mb-2">{partner.profileHeadline}</p>
        )}

        <div className="flex flex-wrap justify-center gap-1 mb-3">
          {visibleServices.map((s) => (
            <span
              key={s.slug}
              className="inline-block bg-primary-50 text-primary-700 text-[11px] font-medium px-2 py-0.5 rounded-full"
            >
              {s.name}
            </span>
          ))}
          {extraServices > 0 && (
            <span className="inline-block bg-slate-100 text-slate-600 text-[11px] font-medium px-2 py-0.5 rounded-full">
              +{extraServices}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-4">
          {showRating ? (
            <span className="inline-flex items-center gap-0.5 text-slate-700 font-medium">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              {partner.rating.toFixed(1)}
              <span className="text-slate-400 font-normal">({partner.totalReviews})</span>
            </span>
          ) : partner.completedServicesCount > 0 ? (
            <span className="text-slate-600">
              {partner.completedServicesCount} servicios completados
            </span>
          ) : (
            <span className="text-emerald-600 font-medium">Nuevo en LoHaggo</span>
          )}
          <span className="text-slate-300">·</span>
          <span>{CITY_NAMES[partner.city] ?? partner.city}</span>
        </div>

        <div className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-primary-600 group-hover:text-primary-700">
          Ver perfil
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </Link>
  )
}

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Star } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import ServiceIcon from '@/components/ServiceIcon'

export interface ServiceCardData {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  basePrice: number
  category: { name: string; slug: string }
  _count: { partners: number }
  partnerStats?: { availableCount: number; avgRating: number }
  showPartnerCount?: boolean
  showAvgRating?: boolean
}

/** Catalogue card shared by /servicios (client) and the home (server); the favourite button comes in as a slot. */
export function ServiceCardView({ service, favoriteSlot }: { service: ServiceCardData; favoriteSlot?: ReactNode }) {
  const isFeatured = service.slug === 'lohaggo-ya'
  const available = service.partnerStats?.availableCount ?? service._count.partners
  const rating = service.partnerStats?.avgRating ?? 0
  return (
    <Link
      href={`/servicios/${service.slug}`}
      className={`relative flex flex-col bg-white rounded-2xl shadow-card hover:shadow-cardHover transition-shadow overflow-hidden group border active:scale-[0.99] ${
        isFeatured ? 'border-primary-200 ring-1 ring-primary-100' : 'border-slate-100'
      }`}
    >
      <div className="flex flex-1 flex-col p-3 md:p-6">
        <div className="flex items-start justify-between gap-1 mb-2 md:mb-4">
          <ServiceIcon slug={service.slug} emoji={service.icon} size="lg" animate />
          <div className="flex items-center gap-2">
            {isFeatured && (
              <span className="hidden md:inline bg-gradient-to-r from-primary-500 to-secondary-500 text-white text-xs font-bold px-4 py-2 rounded-full">
                Destacado
              </span>
            )}
            <span className="hidden md:inline bg-gradient-to-r from-primary-500/10 to-secondary-500/10 text-primary-600 text-xs font-bold px-4 py-2 rounded-full border border-primary-500/20">
              {service.category.name}
            </span>
            {favoriteSlot}
          </div>
        </div>
        <h3 className="font-bold text-[15px] leading-snug md:text-xl mb-1 md:mb-3 group-hover:text-primary-600 transition text-gray-900 line-clamp-2">
          {service.name}
        </h3>
        {isFeatured && (
          <p className="mb-2 hidden md:inline-flex self-start items-center rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary-700">
            Encargos y diligencias express
          </p>
        )}
        <p className="text-gray-600 text-xs md:text-sm mb-2 md:mb-4 line-clamp-2 font-medium">
          {service.description}
        </p>
        <div className="mt-auto flex flex-col gap-1 pt-2 md:flex-row md:items-center md:justify-between md:pt-4 border-t border-slate-100">
          <div className="text-left">
            <p className="text-gray-500 text-[11px] md:text-xs font-medium md:mb-1">Desde</p>
            <p className="text-primary-600 text-sm md:text-lg font-black">
              {formatCurrency(service.basePrice)}
            </p>
          </div>
          <div className="flex items-center gap-2 md:block md:text-right">
            {service.showAvgRating !== false && rating > 0 && (
              <div className="flex items-center gap-1 md:mb-1 md:justify-end">
                <Star className="w-3.5 h-3.5 md:w-4 md:h-4 text-yellow-500 fill-yellow-500" />
                <span className="text-xs md:text-sm font-bold text-gray-900">{rating.toFixed(1)}</span>
              </div>
            )}
            {service.showPartnerCount !== false && available > 0 && (
              <p className="text-gray-500 text-[11px] md:text-xs font-medium">
                {available} {available === 1 ? 'disponible' : 'disponibles'}
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

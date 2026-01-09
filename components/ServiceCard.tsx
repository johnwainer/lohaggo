'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Star, MapPin } from 'lucide-react'
import { isNativePlatform } from '@/lib/platform'

interface ServiceCardProps {
  service: {
    id: string
    slug: string
    name: string
    description: string
    image: string
    category: {
      name: string
      slug: string
    }
    _count?: {
      bookings: number
      reviews: number
    }
    averageRating?: number
    city?: {
      name: string
    }
  }
}

export default function ServiceCard({ service }: ServiceCardProps) {
  const isMobile = isNativePlatform()
  const href = isMobile ? `/servicios?slug=${service.slug}` : `/servicios/${service.slug}`

  return (
    <Link
      href={href}
      className="group bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100"
    >
      <div className="relative h-48 overflow-hidden">
        <Image
          src={service.image || '/placeholder-service.jpg'}
          alt={service.name}
          fill
          className="object-cover group-hover:scale-110 transition-transform duration-300"
        />
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium text-gray-700">
          {service.category.name}
        </div>
      </div>
      
      <div className="p-4">
        <h3 className="font-bold text-lg mb-2 group-hover:text-primary-600 transition-colors line-clamp-1">
          {service.name}
        </h3>
        
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
          {service.description}
        </p>
        
        <div className="flex items-center justify-between text-sm">
          {service.averageRating && service._count?.reviews ? (
            <div className="flex items-center gap-1 text-yellow-500">
              <Star className="w-4 h-4 fill-current" />
              <span className="font-semibold text-gray-900">
                {service.averageRating.toFixed(1)}
              </span>
              <span className="text-gray-500">
                ({service._count.reviews})
              </span>
            </div>
          ) : (
            <span className="text-gray-400 text-xs">Sin reseñas</span>
          )}
          
          {service.city && (
            <div className="flex items-center gap-1 text-gray-500">
              <MapPin className="w-4 h-4" />
              <span>{service.city.name}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

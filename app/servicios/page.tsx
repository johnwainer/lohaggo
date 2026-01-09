'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Search, Filter, X, Star, ArrowLeft, Clock, DollarSign, MapPin } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import ServicesTour from '@/components/ServicesTour'
import { apiClient } from '@/lib/api-client'
import { isNativePlatform } from '@/lib/platform'

interface Service {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  image?: string
  basePrice: number
  duration: number
  category: {
    name: string
    slug: string
  }
  _count: {
    partners: number
    reviews?: number
  }
  averageRating?: number
  city?: {
    name: string
  }
}

interface Category {
  id: string
  name: string
  slug: string
  icon: string
}

function ServiciosContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [serviceDetail, setServiceDetail] = useState<Service | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const slugParam = searchParams.get('slug')
  const isMobile = isNativePlatform()

  const fetchServiceDetail = async (slug: string) => {
    setLoadingDetail(true)
    try {
      console.log('[Servicios] Fetching service detail:', slug)
      const data = await apiClient.get<Service>(`/services/${slug}`)
      console.log('[Servicios] Service detail loaded:', data)
      setServiceDetail(data)
    } catch (error) {
      console.error('[Servicios] Error fetching service detail:', error)
      setServiceDetail(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  const fetchCategories = async () => {
    try {
      console.log('[Servicios] Fetching categories...')
      const data = await apiClient.get<Category[]>('/categories')
      console.log('[Servicios] Categories loaded:', data.length)
      setCategories(data)
    } catch (error) {
      console.error('[Servicios] Error fetching categories:', error)
    }
  }

  const fetchServices = async () => {
    setLoading(true)
    try {
      let endpoint = '/services?'
      if (selectedCategory) endpoint += `category=${selectedCategory}&`
      if (searchTerm) endpoint += `search=${searchTerm}&`

      console.log('[Servicios] Fetching services from:', endpoint)
      const data = await apiClient.get<Service[]>(endpoint)
      console.log('[Servicios] Services loaded:', data.length)
      setServices(data)
    } catch (error) {
      console.error('[Servicios] Error fetching services:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      await fetchCategories()

      const urlSearch = searchParams.get('search')
      const urlCategory = searchParams.get('category')

      if (urlSearch) {
        setSearchTerm(urlSearch)
      }
      if (urlCategory) {
        setSelectedCategory(urlCategory)
      }

      setInitialized(true)
    }

    init()
  }, [searchParams])

  useEffect(() => {
    if (slugParam && isMobile) {
      fetchServiceDetail(slugParam)
    } else {
      setServiceDetail(null)
    }
  }, [slugParam, isMobile])

  useEffect(() => {
    if (initialized && !slugParam) {
      fetchServices()
    }
  }, [selectedCategory, searchTerm, initialized, slugParam])

  if (slugParam && isMobile) {
    if (loadingDetail) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando servicio...</p>
          </div>
        </div>
      )
    }

    if (!serviceDetail) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Servicio no encontrado</h1>
            <p className="text-gray-600 mb-6">El servicio que buscas no existe.</p>
            <button
              onClick={() => router.push('/servicios')}
              className="bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition"
            >
              Ver todos los servicios
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="relative h-64 md:h-96">
          <Image
            src={serviceDetail.image || '/placeholder-service.jpg'}
            alt={serviceDetail.name}
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

          <button
            onClick={() => router.push('/servicios')}
            className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm p-2 rounded-full hover:bg-white transition"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>

          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <div className="max-w-4xl mx-auto">
              <span className="inline-block bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium mb-3">
                {serviceDetail.category.name}
              </span>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">{serviceDetail.name}</h1>
              {serviceDetail.averageRating && serviceDetail._count?.reviews ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Star className="w-5 h-5 fill-current text-yellow-400" />
                    <span className="font-semibold">{serviceDetail.averageRating.toFixed(1)}</span>
                  </div>
                  <span className="text-white/80">({serviceDetail._count.reviews} reseñas)</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Descripción</h2>
            <p className="text-gray-600 leading-relaxed">{serviceDetail.description}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Detalles del servicio</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <DollarSign className="w-8 h-8 text-primary-600" />
                <div>
                  <p className="text-sm text-gray-600">Precio desde</p>
                  <p className="font-bold text-lg">{formatCurrency(serviceDetail.basePrice)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <Clock className="w-8 h-8 text-primary-600" />
                <div>
                  <p className="text-sm text-gray-600">Duración</p>
                  <p className="font-bold text-lg">{serviceDetail.duration} min</p>
                </div>
              </div>
              {serviceDetail.city && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <MapPin className="w-8 h-8 text-primary-600" />
                  <div>
                    <p className="text-sm text-gray-600">Ubicación</p>
                    <p className="font-bold text-lg">{serviceDetail.city.name}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => router.push(`/login?callbackUrl=/servicios?slug=${serviceDetail.slug}`)}
            className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-primary-700 transition shadow-lg"
          >
            Contratar servicio
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ServicesTour />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black mb-2 md:mb-3 text-gray-900">
            Todos los servicios
          </h1>
          <p className="text-gray-600 text-base md:text-lg font-medium">
            Encuentra el servicio perfecto para ti
          </p>
        </div>

        <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl p-4 md:p-6 mb-6 md:mb-8 border-2 border-transparent hover:border-primary-500/20 transition">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative" data-tour="services-search">
              <Search className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Buscar servicios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 md:pl-12 pr-4 py-3 md:py-4 border-2 border-gray-200 rounded-xl md:rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-gray-800 font-medium transition text-sm md:text-base"
              />
            </div>
          </div>

          <div className="mt-4 md:mt-6" data-tour="services-categories">
            <div className="flex items-center gap-2 mb-3 md:mb-4">
              <Filter size={18} className="text-gray-700 md:w-[22px] md:h-[22px]" />
              <span className="font-bold text-gray-900 text-base md:text-lg">Categorías:</span>
            </div>
            <div className="flex flex-wrap gap-2 md:gap-3">
              <button
                onClick={() => setSelectedCategory('')}
                className={`px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl transition-all font-bold shadow-md text-sm md:text-base ${
                  selectedCategory === ''
                    ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105'
                }`}
              >
                Todas
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.slug)}
                  className={`px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl transition-all flex items-center gap-2 font-bold shadow-md text-sm md:text-base ${
                    selectedCategory === category.slug
                      ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105'
                  }`}
                >
                  <span className="emoji-icon" style={{ fontSize: '3em' }}>{category.icon}</span>
                  <span className="hidden sm:inline">{category.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 md:py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 md:h-16 md:w-16 border-4 border-primary-500 border-t-transparent"></div>
            <p className="mt-4 md:mt-6 text-gray-600 text-base md:text-lg font-medium">Buscando servicios...</p>
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-12 md:py-16 bg-white rounded-2xl md:rounded-3xl shadow-xl">
            <div className="text-5xl md:text-6xl mb-4">😔</div>
            <p className="text-gray-600 text-lg md:text-xl font-bold">No se encontraron servicios</p>
            {searchTerm ? (
              <p className="text-gray-500 mt-2 text-sm md:text-base px-4">
                No encontramos resultados para "<span className="font-semibold text-primary-600">{searchTerm}</span>".
                Intenta con otros términos como: plomero, electricista, limpieza, etc.
              </p>
            ) : (
              <p className="text-gray-500 mt-2 text-sm md:text-base">Intenta con otra búsqueda o categoría</p>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 md:mb-6">
              {searchTerm ? (
                <div className="bg-white rounded-xl md:rounded-2xl shadow-lg p-3 md:p-4 border-l-4 border-primary-500">
                  <p className="text-gray-700 font-bold text-base md:text-lg">
                    {services.length} {services.length === 1 ? 'resultado encontrado' : 'resultados encontrados'} para
                    <span className="text-primary-600"> "{searchTerm}"</span>
                  </p>
                  <p className="text-gray-600 text-xs md:text-sm mt-1">
                    Mostrando los servicios más relevantes
                  </p>
                </div>
              ) : (
                <p className="text-gray-700 font-bold text-base md:text-lg">
                  {services.length} {services.length === 1 ? 'servicio disponible' : 'servicios disponibles'}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6" data-tour="services-grid">
              {services.map((service) => {
                const href = isMobile ? `/servicios?slug=${service.slug}` : `/servicios/${service.slug}`
                return (
                <Link
                  key={service.id}
                  href={href}
                  className="bg-white rounded-xl md:rounded-2xl shadow-md hover:shadow-2xl transition-all overflow-hidden group border-2 border-gray-100 hover:border-primary-500/30 transform hover:scale-105"
                >
                  <div className="p-4 md:p-6">
                    <div className="flex items-start justify-between mb-3 md:mb-4">
                      <span className="emoji-icon group-hover:scale-110 transition-transform inline-block" style={{ fontSize: '3em' }}>
                        {service.icon}
                      </span>
                      <span className="bg-gradient-to-r from-primary-500/10 to-secondary-500/10 text-primary-600 text-xs font-bold px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-primary-500/20">
                        {service.category.name}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg md:text-xl mb-2 md:mb-3 group-hover:text-primary-600 transition text-gray-900">
                      {service.name}
                    </h3>
                    <p className="text-gray-600 text-xs md:text-sm mb-3 md:mb-4 line-clamp-2 font-medium">
                      {service.description}
                    </p>
                    <div className="flex items-center justify-between pt-3 md:pt-4 border-t-2 border-gray-100">
                      <div className="text-left">
                        <p className="text-gray-500 text-xs font-medium mb-1">Desde</p>
                        <p className="text-primary-600 text-base md:text-lg font-black">
                          {formatCurrency(service.basePrice)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 mb-1">
                          <Star className="w-3.5 h-3.5 md:w-4 md:h-4 text-yellow-500 fill-yellow-500" />
                          <span className="text-xs md:text-sm font-bold text-gray-900">4.8</span>
                        </div>
                        <p className="text-gray-500 text-xs font-medium">
                          {service._count.partners} disponibles
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function ServiciosPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
        </div>
      }
    >
      <ServiciosContent />
    </Suspense>
  )
}

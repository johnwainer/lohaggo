'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, Filter, X, Star } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Service {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  basePrice: number
  duration: number
  category: {
    name: string
    slug: string
  }
  _count: {
    partners: number
  }
}

interface Category {
  id: string
  name: string
  slug: string
  icon: string
}

export default function ServiciosPage() {
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCategories()
    fetchServices()
  }, [selectedCategory, searchTerm])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories')
      const data = await res.json()
      setCategories(data)
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchServices = async () => {
    setLoading(true)
    try {
      let url = '/api/services?'
      if (selectedCategory) url += `category=${selectedCategory}&`
      if (searchTerm) url += `search=${searchTerm}&`

      const res = await fetch(url)
      const data = await res.json()
      setServices(data)
    } catch (error) {
      console.error('Error fetching services:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header - Estilo Rappi */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-black mb-3 text-gray-900">
            Todos los servicios
          </h1>
          <p className="text-gray-600 text-lg font-medium">
            Encuentra el servicio perfecto para ti
          </p>
        </div>

        {/* Search and Filters - Estilo Rappi */}
        <div className="bg-white rounded-3xl shadow-xl p-6 mb-8 border-2 border-transparent hover:border-[#FF2D55]/20 transition">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={22} />
              <input
                type="text"
                placeholder="Buscar servicios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#FF2D55] focus:border-[#FF2D55] outline-none text-gray-800 font-medium transition"
              />
            </div>
          </div>

          {/* Category Filters */}
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter size={22} className="text-gray-700" />
              <span className="font-bold text-gray-900 text-lg">Categorías:</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setSelectedCategory('')}
                className={`px-6 py-3 rounded-2xl transition-all font-bold shadow-md ${
                  selectedCategory === ''
                    ? 'bg-gradient-to-r from-[#FF2D55] to-[#FF6900] text-white scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105'
                }`}
              >
                Todas
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.slug)}
                  className={`px-6 py-3 rounded-2xl transition-all flex items-center gap-2 font-bold shadow-md ${
                    selectedCategory === category.slug
                      ? 'bg-gradient-to-r from-[#FF2D55] to-[#FF6900] text-white scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105'
                  }`}
                >
                  <span className="text-xl">{category.icon}</span>
                  <span>{category.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Services Grid - Estilo Rappi */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-[#FF2D55] border-t-transparent"></div>
            <p className="mt-6 text-gray-600 text-lg font-medium">Cargando servicios...</p>
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl shadow-xl">
            <div className="text-6xl mb-4">😔</div>
            <p className="text-gray-600 text-xl font-bold">No se encontraron servicios</p>
            <p className="text-gray-500 mt-2">Intenta con otra búsqueda o categoría</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <p className="text-gray-700 font-bold text-lg">
                {services.length} {services.length === 1 ? 'servicio encontrado' : 'servicios encontrados'}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service) => (
                <Link
                  key={service.id}
                  href={`/servicios/${service.slug}`}
                  className="bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all overflow-hidden group border-2 border-gray-100 hover:border-[#FF2D55]/30 transform hover:scale-105"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="text-5xl group-hover:scale-110 transition-transform">{service.icon}</div>
                      <span className="bg-gradient-to-r from-[#FF2D55]/10 to-[#FF6900]/10 text-[#FF2D55] text-xs font-bold px-4 py-2 rounded-full border border-[#FF2D55]/20">
                        {service.category.name}
                      </span>
                    </div>
                    <h3 className="font-bold text-xl mb-3 group-hover:text-[#FF2D55] transition text-gray-900">
                      {service.name}
                    </h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2 font-medium">
                      {service.description}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t-2 border-gray-100">
                      <div className="text-left">
                        <p className="text-gray-500 text-xs font-medium mb-1">Desde</p>
                        <p className="text-[#FF2D55] text-lg font-black">
                          {formatCurrency(service.basePrice)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 mb-1">
                          <Star className="w-4 h-4 text-[#FFB800] fill-[#FFB800]" />
                          <span className="text-sm font-bold text-gray-900">4.8</span>
                        </div>
                        <p className="text-gray-500 text-xs font-medium">
                          {service._count.partners} disponibles
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

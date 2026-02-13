'use client'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Search, Filter, X, Star, Lightbulb, Clock, Trash2, Heart } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const ServicesTour = dynamic(() => import('@/components/ServicesTour'), {
  ssr: false,
  loading: () => null,
})

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

interface Suggestions {
  didYouMean: string[]
  popularServices: Service[]
  similarServices: Service[]
}

interface SearchHistoryItem {
  id: string
  query: string
  createdAt: string
}

function ServiciosContent() {
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const [services, setServices] = useState<Service[]>([])
  const [relatedServices, setRelatedServices] = useState<Service[]>([])
  const [topMatch, setTopMatch] = useState<Service | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null)
  const [autocompleteResults, setAutocompleteResults] = useState<Service[]>([])
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [favoriteServices, setFavoriteServices] = useState<Set<string>>(new Set())
  const [loadingFavorite, setLoadingFavorite] = useState<string | null>(null)
  const [favoriteServicesList, setFavoriteServicesList] = useState<Service[]>([])
  const [showSlowLoadingHint, setShowSlowLoadingHint] = useState(false)

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories')
      const data = await res.json()
      setCategories(data)
    } catch (error) {
    }
  }

  const fetchSearchHistory = async () => {
    if (!session?.user) return

    try {
      const res = await fetch('/api/search-history')
      if (res.ok) {
        const data = await res.json()
        setSearchHistory(data)
      }
    } catch (error) {
    }
  }

  const saveSearchHistory = async (query: string, hasResults: boolean = true) => {
    if (!session?.user || !query.trim() || query.trim().length < 2) return

    try {
      await fetch('/api/search-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          hasResults
        })
      })
      fetchSearchHistory()
    } catch (error) {
    }
  }

  const deleteSearchHistoryItem = async (id: string) => {
    try {
      await fetch(`/api/search-history?id=${id}`, {
        method: 'DELETE'
      })
      setSearchHistory(prev => prev.filter(item => item.id !== id))
    } catch (error) {
    }
  }

  const clearSearchHistory = async () => {
    try {
      await fetch('/api/search-history', {
        method: 'DELETE'
      })
      setSearchHistory([])
    } catch (error) {
    }
  }

  const fetchServices = async () => {
    setLoading(true)
    setShowSlowLoadingHint(false)
    setSuggestions(null)
    setRelatedServices([])
    setTopMatch(null)
    try {
      let url = '/api/services?'
      if (selectedCategory) url += `category=${selectedCategory}&`
      if (searchTerm) url += `search=${searchTerm}&`

      const res = await fetch(url)
      const data = await res.json()

      let resultServices = []
      if (data.services) {
        resultServices = data.services
        setServices(data.services)

        if (data.relatedByCategory && data.relatedByCategory.length > 0) {
          setRelatedServices(data.relatedByCategory)
        }

        if (data.topMatch) {
          setTopMatch(data.topMatch)
        }

        if (data.suggestions) {
          setSuggestions(data.suggestions)
        }
      } else {
        resultServices = data
        setServices(data)
      }

      if (searchTerm && searchTerm.length >= 2) {
        saveSearchHistory(searchTerm, resultServices.length > 0)
      }
    } catch (error) {
    } finally {
      setLoading(false)
      setShowSlowLoadingHint(false)
    }
  }

  const fetchAutocomplete = useCallback(async (term: string) => {
    if (term.length < 2) {
      setAutocompleteResults([])
      setShowAutocomplete(false)
      return
    }

    try {
      let url = `/api/services?search=${term}`
      if (selectedCategory) url += `&category=${selectedCategory}`

      const res = await fetch(url)
      const data = await res.json()

      const results = data.services || data
      setAutocompleteResults(results.slice(0, 5))
      setShowAutocomplete(true)
    } catch (error) {
      setAutocompleteResults([])
    }
  }, [selectedCategory])

  const fetchFavoriteServices = async () => {
    if (!session?.user) return

    try {
      const res = await fetch('/api/favorite-services')
      if (res.ok) {
        const data = await res.json()
        const favoriteIds = new Set<string>(data.map((fav: any) => fav.serviceId))
        setFavoriteServices(favoriteIds)

        const servicesData = data.map((fav: any) => fav.service)
        setFavoriteServicesList(servicesData)
      }
    } catch (error) {
      console.error('Error fetching favorite services:', error)
    }
  }

  const toggleFavoriteService = async (e: React.MouseEvent, serviceId: string) => {
    e.preventDefault()
    e.stopPropagation()

    if (!session?.user) {
      window.location.href = '/login'
      return
    }

    setLoadingFavorite(serviceId)

    try {
      const isFavorite = favoriteServices.has(serviceId)

      let res
      if (isFavorite) {
        res = await fetch(`/api/favorite-services?serviceId=${serviceId}`, {
          method: 'DELETE'
        })
      } else {
        res = await fetch('/api/favorite-services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serviceId })
        })
      }

      if (res.ok) {
        setFavoriteServices(prev => {
          const newSet = new Set(prev)
          if (isFavorite) {
            newSet.delete(serviceId)
          } else {
            newSet.add(serviceId)
          }
          return newSet
        })

        await fetchFavoriteServices()
      }
    } catch (error) {
      console.error('Error toggling favorite service:', error)
    } finally {
      setLoadingFavorite(null)
    }
  }

  useEffect(() => {
    const init = async () => {
      await fetchCategories()
      await fetchSearchHistory()

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
    console.log('Session status:', session?.user ? 'Logged in' : 'Not logged in', session)
    if (session?.user) {
      fetchSearchHistory()
      fetchFavoriteServices()
    }
  }, [session])

  useEffect(() => {
    if (initialized) {
      const timeoutId = setTimeout(() => {
        fetchServices()
      }, 300)

      return () => clearTimeout(timeoutId)
    }
  }, [selectedCategory, searchTerm, initialized])

  useEffect(() => {
    if (searchTerm && !loading) {
      const timeoutId = setTimeout(() => {
        fetchAutocomplete(searchTerm)
      }, 300)

      return () => clearTimeout(timeoutId)
    } else {
      setShowAutocomplete(false)
    }
  }, [searchTerm, loading, fetchAutocomplete])

  useEffect(() => {
    if (!loading) {
      setShowSlowLoadingHint(false)
      return
    }

    const slowLoadingTimer = setTimeout(() => {
      setShowSlowLoadingHint(true)
    }, 4000)

    return () => clearTimeout(slowLoadingTimer)
  }, [loading])

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
                placeholder="¿Qué servicio necesitas? Ej: plomero"
                value={searchTerm}
                onChange={(e) => {
                  const value = e.target.value
                  setSearchTerm(value)
                  if (value.length >= 2) {
                    setShowHistory(false)
                    setShowAutocomplete(true)
                  } else {
                    setShowAutocomplete(false)
                    if (value.length === 0) {
                      setShowHistory(true)
                    }
                  }
                }}
                onFocus={() => {
                  if (searchTerm.length >= 2) {
                    setShowAutocomplete(true)
                  } else if (searchTerm.length === 0) {
                    setShowHistory(true)
                  }
                }}
                onBlur={() => {
                  setTimeout(() => {
                    setShowAutocomplete(false)
                    setShowHistory(false)
                  }, 150)
                }}
                className="w-full pl-10 md:pl-12 pr-4 py-3 md:py-4 border-2 border-gray-200 rounded-xl md:rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-gray-800 font-medium transition text-sm md:text-base"
              />

              {showHistory && searchHistory.length > 0 && !searchTerm && session?.user && (
                <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border-2 border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-3 bg-gradient-to-r from-primary-50 to-secondary-50 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-gray-700" />
                      <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Búsquedas recientes</p>
                    </div>
                    <button
                      onClick={clearSearchHistory}
                      className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1"
                    >
                      <Trash2 size={14} />
                      Limpiar
                    </button>
                  </div>
                  <div className="max-h-[250px] overflow-y-auto">
                    {searchHistory.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 hover:bg-gradient-to-r hover:from-primary-50 hover:to-secondary-50 transition-all duration-200 border-b border-gray-100 last:border-0 group"
                      >
                        <Clock size={16} className="text-gray-400 group-hover:text-primary-500 transition-colors" />
                        <button
                          onClick={() => {
                            setSearchTerm(item.query)
                            setShowHistory(false)
                          }}
                          className="flex-1 text-left text-sm text-gray-700 group-hover:text-primary-600 font-medium transition-colors"
                        >
                          {item.query}
                        </button>
                        <button
                          onClick={() => deleteSearchHistoryItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-600"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {false && showAutocomplete && autocompleteResults.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border-2 border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-2 bg-gradient-to-r from-primary-50 to-secondary-50 border-b border-gray-200">
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">💡 Sugerencias</p>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {autocompleteResults.map((service) => (
                      <Link
                        key={service.id}
                        href={`/servicios/${service.slug}`}
                        className="flex items-center gap-3 p-3 hover:bg-gradient-to-r hover:from-primary-50 hover:to-secondary-50 transition-all duration-200 border-b border-gray-100 last:border-0 group"
                      >
                        <span className="text-2xl group-hover:scale-110 transition-transform duration-200">{service.icon}</span>
                        <div className="flex-1">
                          <p className="font-bold text-sm text-gray-900 group-hover:text-primary-600 transition-colors">{service.name}</p>
                          <p className="text-xs text-gray-500">{service.category.name}</p>
                        </div>
                        <p className="text-sm font-bold text-primary-600">{formatCurrency(service.basePrice)}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {session?.user && favoriteServicesList.length > 0 && (
            <div className="mt-4 md:mt-6">
              <div className="flex items-center gap-2 mb-3 md:mb-4">
                <Heart size={18} className="text-primary-600 md:w-[22px] md:h-[22px] fill-current" />
                <span className="font-bold text-gray-900 text-base md:text-lg">Mis Favoritos</span>
              </div>
              <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2 scrollbar-hide px-1">
                {favoriteServicesList.map((service) => (
                  <Link
                    key={service.id}
                    href={`/servicios/${service.slug}`}
                    className="flex-shrink-0 flex flex-col items-center gap-2 p-3 md:p-4 bg-gradient-to-br from-primary-50 to-amber-50 hover:from-primary-100 hover:to-amber-100 rounded-xl md:rounded-2xl transition-all shadow-md hover:shadow-lg border-2 border-primary-200 min-w-[80px] md:min-w-[100px]"
                  >
                    <span className="text-3xl md:text-4xl">{service.icon}</span>
                    <span className="text-xs md:text-sm font-bold text-gray-900 text-center line-clamp-2">{service.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div
            className={`mt-4 md:mt-6 transition-all duration-300 ${
              showAutocomplete && autocompleteResults.length > 0
                ? 'opacity-0 max-h-0 overflow-hidden pointer-events-none'
                : 'opacity-100 max-h-[500px]'
            }`}
            data-tour="services-categories"
          >
            <div className="flex items-center gap-2 mb-3 md:mb-4">
              <Filter size={18} className="text-gray-700 md:w-[22px] md:h-[22px]" />
              <span className="font-bold text-gray-900 text-base md:text-lg">Categorías</span>
            </div>
            <div className="grid grid-cols-4 md:flex md:flex-wrap gap-2 md:gap-3">
              <button
                onClick={() => setSelectedCategory('')}
                className={`px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl transition-all font-bold shadow-md text-sm md:text-base ${
                  selectedCategory === ''
                    ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105'
                }`}
              >
                Todos
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
          <div className="py-8 md:py-12">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
              <p className="text-gray-600 text-sm md:text-base font-semibold">Buscando servicios...</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="bg-white rounded-xl md:rounded-2xl shadow-md border-2 border-gray-100 p-4 md:p-6 animate-pulse">
                  <div className="h-10 w-10 md:h-12 md:w-12 bg-gray-200 rounded-lg mb-3"></div>
                  <div className="h-4 md:h-5 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-4/5 mb-4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>

            {showSlowLoadingHint && (
              <div className="mt-6 bg-white border border-primary-200 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-700">
                  Esto está tardando más de lo normal. Verifica tu conexión o intenta de nuevo.
                </p>
                <button
                  onClick={fetchServices}
                  className="mt-3 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition"
                >
                  Reintentar búsqueda
                </button>
              </div>
            )}
          </div>
        ) : services.length === 0 ? (
          <div className="space-y-6">
            <div className="text-center py-12 md:py-16 bg-white rounded-2xl md:rounded-3xl shadow-xl">
              <div className="text-5xl md:text-6xl mb-4">😔</div>
              <p className="text-gray-600 text-lg md:text-xl font-bold">No se encontraron servicios</p>
              {searchTerm && (
                <p className="text-gray-500 mt-2 text-sm md:text-base px-4">
                  No pudimos encontrar resultados para "<span className="font-semibold text-primary-600">{searchTerm}</span>".
                </p>
              )}
            </div>

            {suggestions && (
              <>
                {(suggestions?.didYouMean?.length ?? 0) > 0 && (
                  <div className="bg-white rounded-2xl shadow-lg p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Lightbulb className="text-yellow-500" size={24} />
                      <h3 className="text-lg font-bold text-gray-900">¿Quisiste decir?</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {suggestions?.didYouMean?.map((term, index) => (
                        <button
                          key={index}
                          onClick={() => setSearchTerm(term)}
                          className="px-4 py-2 bg-primary-50 text-primary-700 rounded-lg font-semibold hover:bg-primary-100 transition"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(suggestions?.similarServices?.length ?? 0) > 0 && (
                  <div className="bg-white rounded-2xl shadow-lg p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Servicios similares</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {suggestions?.similarServices?.map((service) => (
                        <Link
                          key={service.id}
                          href={`/servicios/${service.slug}`}
                          className="bg-gray-50 rounded-xl p-4 hover:shadow-lg transition border-2 border-gray-100 hover:border-primary-500/30"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-3xl">{service.icon}</span>
                            <div className="flex-1">
                              <h4 className="font-bold text-sm text-gray-900">{service.name}</h4>
                              <p className="text-xs text-gray-500">{service.category.name}</p>
                            </div>
                          </div>
                          <p className="text-sm font-bold text-primary-600">{formatCurrency(service.basePrice)}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {(suggestions?.popularServices?.length ?? 0) > 0 && (
                  <div className="bg-white rounded-2xl shadow-lg p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Servicios populares</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {suggestions?.popularServices?.map((service) => (
                        <Link
                          key={service.id}
                          href={`/servicios/${service.slug}`}
                          className="bg-gray-50 rounded-xl p-4 hover:shadow-lg transition border-2 border-gray-100 hover:border-primary-500/30"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-3xl">{service.icon}</span>
                            <div className="flex-1">
                              <h4 className="font-bold text-sm text-gray-900">{service.name}</h4>
                              <p className="text-xs text-gray-500">{service.category.name}</p>
                            </div>
                          </div>
                          <p className="text-sm font-bold text-primary-600">{formatCurrency(service.basePrice)}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </>
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
                    Mostrando los resultados más relevantes
                  </p>
                </div>
              ) : (
                <p className="text-gray-700 font-bold text-base md:text-lg">
                  {services.length} {services.length === 1 ? 'servicio disponible' : 'servicios disponibles'}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6" data-tour="services-grid">
              {services.map((service) => (
                <Link
                  key={service.id}
                  href={`/servicios/${service.slug}`}
                  className="bg-white rounded-xl md:rounded-2xl shadow-md hover:shadow-2xl transition-all overflow-hidden group border-2 border-gray-100 hover:border-primary-500/30 transform hover:scale-105"
                >
                  <div className="p-4 md:p-6">
                    <div className="flex items-start justify-between mb-3 md:mb-4">
                      <span className="emoji-icon group-hover:scale-110 transition-transform inline-block" style={{ fontSize: '3em' }}>
                        {service.icon}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="bg-gradient-to-r from-primary-500/10 to-secondary-500/10 text-primary-600 text-xs font-bold px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-primary-500/20">
                          {service.category.name}
                        </span>
                        <button
                          onClick={(e) => toggleFavoriteService(e, service.id)}
                          disabled={loadingFavorite === service.id || !session?.user}
                          className={`p-2 md:p-2.5 rounded-lg md:rounded-xl transition-all shadow-md hover:shadow-lg ${
                            favoriteServices.has(service.id)
                              ? 'bg-gradient-to-br from-primary-100 to-amber-100 text-primary-600 hover:from-orange-200 hover:to-amber-200'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          } ${loadingFavorite === service.id || !session?.user ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={!session?.user ? 'Inicia sesión para agregar a favoritos' : favoriteServices.has(service.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                        >
                          <Heart className="w-5 h-5 md:w-5 md:h-5" fill={favoriteServices.has(service.id) ? 'currentColor' : 'none'} />
                        </button>
                      </div>
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
              ))}
            </div>

            {relatedServices.length > 0 && (
              <div className="mt-8 md:mt-12">
                <div className="bg-gradient-to-r from-primary-50 to-secondary-50 rounded-2xl md:rounded-3xl p-6 md:p-8 border-2 border-primary-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-white p-3 rounded-xl shadow-md">
                      <Lightbulb className="text-primary-600" size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl md:text-2xl font-bold text-gray-900">
                        Servicios relacionados
                      </h3>
                      <p className="text-gray-600 text-sm md:text-base">
                        Otros servicios de {topMatch?.category.name || 'esta categoría'} que podrían interesarte
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {relatedServices.map((service) => (
                      <Link
                        key={service.id}
                        href={`/servicios/${service.slug}`}
                        className="bg-white rounded-xl md:rounded-2xl shadow-md hover:shadow-xl transition-all overflow-hidden group border-2 border-gray-100 hover:border-primary-500/30 transform hover:scale-105"
                      >
                        <div className="p-4 md:p-5">
                          <div className="flex items-start justify-between mb-3">
                            <span className="emoji-icon group-hover:scale-110 transition-transform inline-block" style={{ fontSize: '2.5em' }}>
                              {service.icon}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="bg-primary-50 text-primary-600 text-xs font-bold px-3 py-1.5 rounded-full">
                                {service.category.name}
                              </span>
                              <button
                                onClick={(e) => toggleFavoriteService(e, service.id)}
                                disabled={loadingFavorite === service.id || !session?.user}
                                className={`p-2 md:p-2 rounded-lg transition-all shadow-md hover:shadow-lg ${
                                  favoriteServices.has(service.id)
                                    ? 'bg-gradient-to-br from-primary-100 to-amber-100 text-primary-600 hover:from-orange-200 hover:to-amber-200'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                } ${loadingFavorite === service.id || !session?.user ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title={!session?.user ? 'Inicia sesión para agregar a favoritos' : favoriteServices.has(service.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                              >
                                <Heart className="w-4 h-4 md:w-4 md:h-4" fill={favoriteServices.has(service.id) ? 'currentColor' : 'none'} />
                              </button>
                            </div>
                          </div>
                          <h4 className="font-bold text-base md:text-lg mb-2 group-hover:text-primary-600 transition text-gray-900">
                            {service.name}
                          </h4>
                          <p className="text-gray-600 text-xs md:text-sm mb-3 line-clamp-2">
                            {service.description}
                          </p>
                          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                            <div className="text-left">
                              <p className="text-gray-500 text-xs mb-1">Desde</p>
                              <p className="text-primary-600 text-sm md:text-base font-bold">
                                {formatCurrency(service.basePrice)}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-1 mb-1">
                                <Star className="w-3 h-3 md:w-3.5 md:h-3.5 text-yellow-500 fill-yellow-500" />
                                <span className="text-xs font-bold text-gray-900">4.8</span>
                              </div>
                              <p className="text-gray-500 text-xs">
                                {service._count.partners} disponibles
                              </p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
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

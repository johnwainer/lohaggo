'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ChevronDown, Filter, Search } from 'lucide-react'
import ServiceIcon from '@/components/ServiceIcon'
import { useCity } from '@/lib/city-context'
import { FavoriteHeartButton } from '@/components/services/FavoriteHeartButton'

const DEFAULT_CITY = 'medellin'

// Full interactive catalogue: only downloaded when the visitor picked another city.
const ServiciosContent = dynamic(
  () => import('@/components/services/ServiciosContent').then((m) => m.ServiciosContent),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent" />
      </div>
    ),
  }
)

/** Server-rendered Medellín catalogue by default; the client catalogue takes over for other cities or when the server had no data. */
export function HomeCatalogCityGate({
  catalog,
  interleaveSlot,
  whatsappPhone,
  homeLimit,
}: {
  catalog: ReactNode
  interleaveSlot?: ReactNode
  whatsappPhone: string | null
  homeLimit: number
}) {
  const { selectedCity } = useCity()

  if (!catalog || (selectedCity && selectedCity !== DEFAULT_CITY)) {
    return (
      <ServiciosContent
        showHeading={false}
        interleaveSlot={interleaveSlot}
        whatsappPhone={whatsappPhone}
        homeLimit={homeLimit}
      />
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 md:py-8">
        {catalog}
        {interleaveSlot}
      </div>
    </div>
  )
}

export function HomeSearchForm({ examples }: { examples: string[] }) {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [placeholder, setPlaceholder] = useState('¿Qué buscas?')
  const indexRef = useRef(0)

  useEffect(() => {
    if (examples.length === 0) return
    const shuffled = [...examples].sort(() => Math.random() - 0.5)
    setPlaceholder(`¿Qué buscas? Ej: ${shuffled[0]}`)
    const id = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % shuffled.length
      setPlaceholder(`¿Qué buscas? Ej: ${shuffled[indexRef.current]}`)
    }, 2500)
    return () => clearInterval(id)
  }, [examples])

  return (
    <form
      action="/servicios"
      method="get"
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        const q = value.trim()
        router.push(q ? `/servicios?q=${encodeURIComponent(q)}` : '/servicios')
      }}
      className="flex-1 relative"
      data-tour="services-search"
    >
      <Search className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={22} aria-hidden="true" />
      <input
        type="search"
        name="q"
        enterKeyHint="search"
        aria-label="Buscar servicios"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full pl-11 md:pl-13 pr-4 py-3.5 md:py-4 border border-slate-200 rounded-full focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none text-slate-900 font-medium transition text-sm md:text-base placeholder:text-slate-400 bg-slate-50 focus:bg-white [&::-webkit-search-cancel-button]:hidden"
      />
    </form>
  )
}

export interface HomeCategory {
  id: string
  name: string
  slug: string
  icon: string
}

export function HomeCategoryGrid({ categories }: { categories: HomeCategory[] }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? categories : categories.slice(0, 12)

  return (
    <div className="mt-4 md:mt-6" data-tour="services-categories">
      <div className="flex items-center justify-between gap-2 mb-3 md:mb-4">
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-gray-700 md:w-[22px] md:h-[22px]" />
          <span className="font-bold text-gray-900 text-base md:text-lg">Categorías</span>
        </div>
        {categories.length > 7 && (
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className={`inline-flex min-h-[44px] items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-4 text-xs font-semibold text-gray-700 hover:border-primary-200 hover:text-primary-700 ${categories.length > 12 ? '' : 'md:hidden'}`}
          >
            {showAll ? 'Ver menos' : 'Ver más'}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAll ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 md:flex md:flex-wrap gap-2 md:gap-3">
        <Link
          href="/servicios"
          aria-current="true"
          className="flex min-h-[72px] items-center justify-center px-2 md:min-h-0 md:px-6 py-2.5 md:py-3 rounded-2xl transition-colors font-semibold text-xs md:text-base bg-primary-600 text-white shadow-card"
        >
          Todos
        </Link>
        {visible.map((category, idx) => (
          <Link
            key={category.id}
            href={`/servicios?category=${encodeURIComponent(category.slug)}`}
            aria-label={category.name}
            className={`min-h-[72px] min-w-0 flex-col md:min-h-0 md:flex-row px-1 md:px-6 py-2 md:py-3 rounded-2xl transition-colors items-center justify-center gap-1 md:gap-2 font-semibold text-sm md:text-base ${
              !showAll && idx >= 7 ? 'hidden md:flex' : 'flex'
            } ${
              category.slug === 'favor'
                ? 'bg-secondary-50 text-secondary-700 hover:bg-secondary-100 border border-secondary-200'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ServiceIcon slug={category.slug} emoji={category.icon} isCategory size="lg" animate />
            <span className="w-full truncate text-center text-[11px] leading-tight md:w-auto md:text-base md:leading-normal">{category.name}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

type FavoritesCtx = {
  isLoggedIn: boolean
  favorites: Set<string>
  loadingId: string | null
  toggle: (e: React.MouseEvent, serviceId: string) => void
}

const FavoritesContext = createContext<FavoritesCtx | null>(null)

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const userId = session?.user?.id
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const favoritesRef = useRef(favorites)
  favoritesRef.current = favorites

  useEffect(() => {
    if (!userId) return
    fetch('/api/favorite-services')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { serviceId: string }[]) => setFavorites(new Set(data.map((f) => f.serviceId))))
      .catch(() => null)
  }, [userId])

  const toggle = useCallback(
    async (e: React.MouseEvent, serviceId: string) => {
      e.preventDefault()
      e.stopPropagation()
      if (!userId) {
        window.location.href = '/login'
        return
      }
      setLoadingId(serviceId)
      try {
        const isFavorite = favoritesRef.current.has(serviceId)
        const res = isFavorite
          ? await fetch(`/api/favorite-services?serviceId=${serviceId}`, { method: 'DELETE' })
          : await fetch('/api/favorite-services', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ serviceId }),
            })
        if (res.ok) {
          setFavorites((prev) => {
            const next = new Set(prev)
            if (isFavorite) next.delete(serviceId)
            else next.add(serviceId)
            return next
          })
        }
      } catch {
        // keep the current state
      } finally {
        setLoadingId(null)
      }
    },
    [userId]
  )

  return (
    <FavoritesContext.Provider value={{ isLoggedIn: !!userId, favorites, loadingId, toggle }}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function FavoriteHeart({ serviceId }: { serviceId: string }) {
  const ctx = useContext(FavoritesContext)
  return (
    <FavoriteHeartButton
      isFavorite={!!ctx?.favorites.has(serviceId)}
      isLoading={ctx?.loadingId === serviceId}
      isLoggedIn={!!ctx?.isLoggedIn}
      onClick={(e) => ctx?.toggle(e, serviceId)}
    />
  )
}

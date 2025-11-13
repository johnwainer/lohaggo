'use client'

import { createContext, useContext, useMemo, useState, useEffect } from 'react'

export type CityStatus = 'ACTIVE' | 'INACTIVE' | 'COMING_SOON'
export type CityOption = {
  id: string
  slug: string
  name: string
  status: CityStatus
  order: number
}

type CityContextValue = {
  selectedCity: string
  setSelectedCity: (citySlug: string) => void
  cities: CityOption[]
  loading: boolean
  getActiveCities: () => CityOption[]
  getCityBySlug: (slug: string) => CityOption | undefined
}

const CityContext = createContext<CityContextValue | undefined>(undefined)

export function CityProvider({ children }: { children: React.ReactNode }) {
  const [selectedCity, setSelectedCityState] = useState<string>('')
  const [cities, setCities] = useState<CityOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    const fetchCities = async () => {
      try {
        const res = await fetch('/api/cities', { signal: controller.signal })
        if (!res.ok) {
          console.error('Failed to fetch cities')
          setLoading(false)
          return
        }

        const data = await res.json()
        if (!Array.isArray(data)) {
          setLoading(false)
          return
        }

        const mappedCities: CityOption[] = data
          .map((city: any) => ({
            id: city.id,
            slug: city.slug,
            name: city.name,
            status: city.status as CityStatus,
            order: city.order || 0
          }))
          .sort((a, b) => a.order - b.order)

        setCities(mappedCities)

        if (mappedCities.length > 0 && !selectedCity) {
          const activeCity = mappedCities.find((c) => c.status === 'ACTIVE')
          const defaultCity = activeCity || mappedCities[0]
          setSelectedCityState(defaultCity.slug)
        }

        setLoading(false)
      } catch (error: any) {
        if (error.name === 'AbortError') return
        console.error('Error fetching cities:', error)
        setLoading(false)
      }
    }

    fetchCities()

    return () => {
      controller.abort()
    }
  }, [])

  const setSelectedCity = (citySlug: string) => {
    const city = cities.find(c => c.slug === citySlug)
    if (city) {
      setSelectedCityState(citySlug)
      if (typeof window !== 'undefined') {
        localStorage.setItem('selectedCity', citySlug)
      }
    }
  }

  const getActiveCities = () => {
    return cities.filter(c => c.status === 'ACTIVE')
  }

  const getCityBySlug = (slug: string) => {
    return cities.find(c => c.slug === slug)
  }

  const value = useMemo(
    () => ({
      selectedCity,
      setSelectedCity,
      cities,
      loading,
      getActiveCities,
      getCityBySlug,
    }),
    [selectedCity, cities, loading]
  )

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>
}

export function useCity() {
  const context = useContext(CityContext)
  if (!context) {
    throw new Error('useCity debe usarse dentro de un CityProvider')
  }
  return context
}
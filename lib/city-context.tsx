'use client'

import { createContext, useContext, useMemo, useState, useEffect } from 'react'

export type CityId = 'MEDELLIN' | 'BOGOTA' | 'CALI' | 'BARRANQUILLA'
export type CityStatus = 'ACTIVE' | 'INACTIVE' | 'COMING_SOON'
export type CityOption = {
  id: CityId
  name: string
  status: CityStatus
  // Keep `active` for backward compatibility with existing consumers in the file
  active?: boolean
}

type CityContextValue = {
  selectedCity: CityId
  setSelectedCity: (city: CityId) => void
  cities: CityOption[]
}

const DEFAULT_CITY: CityId = 'MEDELLIN'

export const CITY_OPTIONS: CityOption[] = [
  { id: 'MEDELLIN', name: 'Medellín', status: 'ACTIVE', active: true },
  { id: 'BOGOTA', name: 'Bogotá', status: 'COMING_SOON', active: false },
  { id: 'CALI', name: 'Cali', status: 'COMING_SOON', active: false },
  { id: 'BARRANQUILLA', name: 'Barranquilla', status: 'COMING_SOON', active: false },
]

const VALID_CITY_IDS: CityId[] = ['MEDELLIN', 'BOGOTA', 'CALI', 'BARRANQUILLA']

const CityContext = createContext<CityContextValue | undefined>(undefined)

export function CityProvider({ children }: { children: React.ReactNode }) {
  const [selectedCityState, setSelectedCityState] = useState<CityId>(DEFAULT_CITY)
  const [cities, setCities] = useState<CityOption[]>(CITY_OPTIONS)

  useEffect(() => {
    const controller = new AbortController()
    const fetchCities = async () => {
      try {
        const res = await fetch('/api/cities', { signal: controller.signal })
        if (!res.ok) {
          // Keep defaults if fetch fails
          return
        }
        const data = await res.json()
        if (!Array.isArray(data)) return

        const mappedCities: CityOption[] = data
          .map((city: any) => {
            const slug = typeof city?.slug === 'string' ? city.slug.toUpperCase() : ''
            if (!VALID_CITY_IDS.includes(slug as CityId)) return null

            // Determine status: prefer explicit status string, fall back to boolean `active` if provided
            let statusRaw =
              typeof city?.status === 'string'
                ? city.status.toUpperCase()
                : typeof city?.active === 'boolean'
                ? city.active
                  ? 'ACTIVE'
                  : 'INACTIVE'
                : 'INACTIVE'

            // Validate status value and coerce to CityStatus
            const status = (['ACTIVE', 'INACTIVE', 'COMING_SOON'] as const).includes(
              statusRaw as CityStatus
            )
              ? (statusRaw as CityStatus)
              : 'INACTIVE'

            return {
              id: slug as CityId,
              name: typeof city.name === 'string' ? city.name : slug,
              status,
              active: status === 'ACTIVE',
            } as CityOption
          })
          .filter(Boolean) as CityOption[]

        if (mappedCities.length > 0) {
          setCities(mappedCities)
          // Ensure selected city exists in the fetched list; otherwise pick the first active or default
          const hasSelected = mappedCities.some((c) => c.id === selectedCityState)
          if (!hasSelected) {
            const activeCity = mappedCities.find((c) => c.active) ?? mappedCities[0]
            if (activeCity) {
              setSelectedCityState(activeCity.id)
              // normalize active flags (kept for compatibility)
              setCities((prev) =>
                mappedCities.map((c) => ({ ...c, active: c.id === activeCity.id }))
              )
            }
          } else {
            // normalize active flags based on selectedCityState
            setCities((prev) =>
              mappedCities.map((c) => ({ ...c, active: c.id === selectedCityState }))
            )
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') return
        // keep defaults on error but log for debugging
        console.error('Error fetching cities:', error)
      }
    }

    fetchCities()

    return () => {
      controller.abort()
    }
    // intentionally leaving out selectedCityState to only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // wrapper to keep cities' active flags in sync with selectedCity
  const setSelectedCity = (city: CityId) => {
    setSelectedCityState(city)
    setCities((prev) => prev.map((c) => ({ ...c, active: c.id === city })))
  }

  const value = useMemo(
    () => ({
      selectedCity: selectedCityState,
      setSelectedCity,
      cities,
    }),
    [selectedCityState, cities]
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
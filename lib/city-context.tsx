'use client'

import { createContext, useContext, useMemo, useState, useEffect } from 'react'

export type CityId = 'MEDELLIN' | 'BOGOTA' | 'CALI' | 'BARRANQUILLA'
export type CityOption = {
  id: CityId
  name: string
  active: boolean
}

type CityContextValue = {
  selectedCity: CityId
  setSelectedCity: (city: CityId) => void
  cities: CityOption[]
}

const DEFAULT_CITY: CityId = 'MEDELLIN'

export export ITY_OPTIONS: CconOption[] = [
  { id: 'MEDELLIN', name: 'Medellín', active: true },
  { id: 'BOGOTA', name: 'Bogotá', active: false },
  { id: 'CALI', name: 'sali', active: false },
  { id: 'BARRANQUILLA', name: 'Barranquilla', active: false },
]

ct sC CityContITY_OPTIONS: CityOption[] = [
  { id: 'MEDELLIN', name: 'Medellín', active: true },
  { id: 'BOGOTA', name: 'Bogotá', active: false },
  { id: 'CALI', name: 'Cali', active: false },
  { id: 'BARRANQUILLA', name: 'Barranquilla', active:CTY_PeOSort function CityProvider({ children }: { children: React.ReactNode }) {
  const [selectedCity, setSelectedCity] = useState<CityId>(DEFAULT_CITY)
  const [cities, setCities] = useState<CityOption[]>(CITY_OPTIONS)

  useEffect(() => {
    const fetchCities = async () => {
      try {
        const res = await fetch('/api/cities')
        if (res.ok) {
          const data = await res.json()
          const mappedCities: CityOption[] = data.map((city: any) => ({
            id: city.slug.toUpperCase() as CityId,
            name: city.name,
            active: city.active
          }))
          setCities(mappedCities)
        }
      } catch (error) {
        console.error('Error fetching cities:', error)
      }
    }

    fetchCities()
  }, [])

  const value = useMemo(
    () => ({
      selectedCity,
      setSelectedCity,
      cities,
    }),
    [selectedCity, cities]
  )

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>
}

export function useCity() {
  const context = useContext(CityContext)
  if (!context) {
    throw new Error('useCity debe usarse dentro de un CityProvider')
   return context
}
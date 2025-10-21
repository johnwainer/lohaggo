'use client'

import { createContext, useContext, useMemo, useState } from 'react'

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

export const CITY_OPTIONS: CityOption[] = [
  { id: 'MEDELLIN', name: 'Medellín', active: true },
  { id: 'BOGOTA', name: 'Bogotá', active: false },
  { id: 'CALI', name: 'Cali', active: false },
  { id: 'BARRANQUILLA', name: 'Barranquilla', active: false },
]

const DEFAULT_CITY: CityId = 'MEDELLIN'

const CityContext = createContext<CityContextValue | undefined>(undefined)

export function CityProvider({ children }: { children: React.ReactNode }) {
  const [selectedCity, setSelectedCity] = useState<CityId>(DEFAULT_CITY)

  const value = useMemo(
    () => ({
      selectedCity,
      setSelectedCity,
      cities: CITY_OPTIONS,
    }),
    [selectedCity]
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

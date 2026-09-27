'use client'

import { useCity } from '@/lib/city-context'

/** « en Medellín» for the city the visitor picked; nothing until one is chosen. */
export function HeroCityName() {
  const { selectedCity, cities } = useCity()
  const city = cities.find((c) => c.slug === selectedCity)
  return city ? <> en {city.name}</> : null
}

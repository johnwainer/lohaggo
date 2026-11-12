'use client'

import { useCity } from '@/lib/city-context'

/**
 * « en Medellín» for the city the visitor picked. Until one is chosen (and in the server-rendered HTML that
 * crawlers read) it shows the default city, so the sentence is never left with an empty gap.
 */
export function HeroCityName({ fallback = 'Medellín' }: { fallback?: string }) {
  const { selectedCity, cities } = useCity()
  const city = cities.find((c) => c.slug === selectedCity)
  return <> en {city ? city.name : fallback}</>
}

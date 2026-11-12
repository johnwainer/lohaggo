/** The closest city that can take requests today (pure: used by the «Pronto en {ciudad}» sheet). */

export type NearCity = {
  slug: string
  name: string
  status: string
  order?: number
  latitude?: number | null
  longitude?: number | null
  partnerRegistry?: boolean
}

/** A city that takes requests now: active and not in partner-registry mode. */
export const isLiveCity = (c: Pick<NearCity, 'status' | 'partnerRegistry'>) => c.status === 'ACTIVE' && !c.partnerRegistry

export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLon = rad(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)))
}

const hasCoords = (c: NearCity): c is NearCity & { latitude: number; longitude: number } =>
  typeof c.latitude === 'number' && typeof c.longitude === 'number'

/** The nearest live city to `from`; without coordinates, the first live one by `order`. Null if none is live. */
export function nearestLiveCity(from: NearCity | undefined, cities: NearCity[]): NearCity | null {
  const live = cities.filter((c) => isLiveCity(c) && c.slug !== from?.slug)
  if (live.length === 0) return null
  if (from && hasCoords(from)) {
    const withCoords = live.filter(hasCoords)
    if (withCoords.length > 0) return withCoords.sort((a, b) => distanceKm(from, a) - distanceKm(from, b))[0]
  }
  return [...live].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0]
}

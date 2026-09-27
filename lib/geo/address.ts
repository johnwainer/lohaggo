/** Pure helpers for the light geolocation flow (GPS → Nominatim reverse → form fields). No maps. */

export type ReverseAddress = { street: string; neighborhood: string; city: string }

type NominatimAddress = Partial<Record<
  'road' | 'pedestrian' | 'footway' | 'house_number' | 'neighbourhood' | 'quarter' | 'suburb' | 'city_district' | 'residential' | 'city' | 'town' | 'village' | 'municipality',
  string
>>

/** Maps a Nominatim `reverse?format=jsonv2` payload to street + neighborhood. Unknown parts come back empty. */
export function parseNominatimReverse(payload: unknown): ReverseAddress {
  const a: NominatimAddress = (payload && typeof payload === 'object' && 'address' in payload && (payload as { address?: unknown }).address && typeof (payload as { address?: unknown }).address === 'object')
    ? (payload as { address: NominatimAddress }).address
    : {}
  const road = (a.road || a.pedestrian || a.footway || '').trim()
  const number = (a.house_number || '').trim()
  const street = road ? (number ? `${road} # ${number}` : road) : ''
  const neighborhood = (a.neighbourhood || a.quarter || a.residential || a.suburb || a.city_district || '').trim()
  const city = (a.city || a.town || a.municipality || a.village || '').trim()
  return { street, neighborhood, city }
}

export function isValidLatLon(lat: number, lon: number) {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
}

/**
 * Splits a free-text Colombian address ("Calle 10 # 43-21 apto 301") into the Address model's
 * street / number / complement. Without a recognizable '# NN-NN' the whole text is the street and number is 'S/N'.
 */
export function splitAddressText(text: string): { street: string; number: string; complement?: string } {
  const clean = text.replace(/\s+/g, ' ').trim()
  const m = /^(.+?)\s*(?:#|n[°º]|no\.?|nro\.?|número)\s*(\d+(?:\s*[a-z](?![a-z]))?(?:\s*-\s*\d+(?:\s*[a-z](?![a-z]))?)?)\s*[,;]?\s*(.*)$/i.exec(clean)
  if (m && m[1].trim().length >= 5) {
    const complement = m[3].trim()
    return { street: m[1].trim(), number: m[2].replace(/\s+/g, ''), ...(complement ? { complement: complement.slice(0, 100) } : {}) }
  }
  return { street: clean.slice(0, 200), number: 'S/N' }
}

/** 'Medellín' → 'MEDELLIN' (the City enum), same normalization the services API uses. */
export function cityEnumFromName(name: string | null | undefined): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, '_')
}

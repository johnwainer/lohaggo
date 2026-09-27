import { NextRequest, NextResponse } from 'next/server'
import { createRateLimiter } from '@/lib/rate-limit'
import { isValidLatLon, parseNominatimReverse } from '@/lib/geo/address'

export const dynamic = 'force-dynamic'

/**
 * GPS → street + neighborhood through OpenStreetMap Nominatim. Proxied (not called from the browser) so the
 * request carries an identifying User-Agent as Nominatim's policy asks, and the CSP needs no new origin.
 * Only called when the user taps "Usar mi ubicación". Returns empty fields on any failure; the user types it.
 */
const limiter = createRateLimiter({ windowMs: 60 * 1000, max: 10, message: 'Demasiadas consultas de ubicación. Escribe tu dirección.' })

async function handle(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat'))
  const lon = Number(req.nextUrl.searchParams.get('lon'))
  if (!isValidLatLon(lat, lon)) return NextResponse.json({ error: 'Ubicación inválida' }, { status: 400 })

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}&accept-language=es&addressdetails=1&zoom=18`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'LoHaggo/1.0 (+https://lohaggo.com; hola@lohaggo.com)',
        Referer: 'https://lohaggo.com',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    })
    if (!res.ok) return NextResponse.json({ street: '', neighborhood: '', city: '' }, { status: 200 })
    return NextResponse.json(parseNominatimReverse(await res.json()), { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ street: '', neighborhood: '', city: '' }, { status: 200 })
  }
}

export async function GET(req: NextRequest) {
  return limiter(req, handle)
}

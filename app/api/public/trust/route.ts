import { NextResponse } from 'next/server'
import { getPublicTrustSafe, publicContactExtras, realTestimonials } from '@/lib/public/trust'

export const revalidate = 600

export async function GET() {
  const trust = await getPublicTrustSafe()
  const [testimonials, extras] = await Promise.all([
    trust.claims.trust_real_testimonials ? realTestimonials(6).catch(() => []) : Promise.resolve([]),
    publicContactExtras(trust.claims),
  ])
  return NextResponse.json(
    { ...trust, testimonials, ...extras },
    { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' } },
  )
}

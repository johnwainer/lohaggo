import { NextResponse } from 'next/server'
import { getFeaturedPartners } from '@/lib/featured-partners'

export const revalidate = 600

export async function GET() {
  const partners = await getFeaturedPartners()
  return NextResponse.json({ partners })
}

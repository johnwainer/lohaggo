import { NextResponse } from 'next/server'
import { firstProposalLabel, typicalFirstProposalMinutes } from '@/lib/service-requests/first-proposal'

export const revalidate = 3600

/** Typical minutes until a request gets its first proposal (median of the last 30 days; 7 by default). */
export async function GET() {
  const minutes = await typicalFirstProposalMinutes()
  return NextResponse.json({ minutes, label: firstProposalLabel(minutes) }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } })
}

import { NextResponse } from 'next/server'
import { googleReviewUrl } from '@/lib/reviews/google-ask'

export const dynamic = 'force-dynamic'

/** Whether the Google review invitation is set up (the thank-you screen shows its button only then). The link itself stays server side. */
export async function GET() {
  return NextResponse.json({ available: Boolean(await googleReviewUrl()) }, { headers: { 'Cache-Control': 'public, max-age=60' } })
}

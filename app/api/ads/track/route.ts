import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { z } from 'zod'

const logger = createLogger('ads-track')

const trackSchema = z.object({
  adId: z.string().min(1),
  type: z.enum(['impression', 'click'])
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const validation = trackSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { adId, type } = validation.data

    const updateData = type === 'impression'
      ? { impressions: { increment: 1 } }
      : { clicks: { increment: 1 } }

    await prisma.advertisement.update({
      where: { id: adId },
      data: updateData
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error tracking ad:', error || undefined)
    return NextResponse.json({ error: 'Error tracking ad' }, { status: 500 })
  }
}

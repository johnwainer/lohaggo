import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { adId, type } = body

    if (!adId || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: adId, type' },
        { status: 400 }
      )
    }

    if (type !== 'impression' && type !== 'click') {
      return NextResponse.json(
        { error: 'Invalid type. Must be "impression" or "click"' },
        { status: 400 }
      )
    }

    const updateData = type === 'impression' 
      ? { impressions: { increment: 1 } }
      : { clicks: { increment: 1 } }

    await prisma.advertisement.update({
      where: { id: adId },
      data: updateData
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error tracking ad:', error)
    return NextResponse.json({ error: 'Error tracking ad' }, { status: 500 })
  }
}

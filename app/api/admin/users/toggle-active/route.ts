import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, isActive } = await req.json()

    if (!userId || typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { partnerProfile: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive }
    })

    if (user.partnerProfile) {
      await prisma.partnerProfile.update({
        where: { userId },
        data: { isActive }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error toggling user active status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

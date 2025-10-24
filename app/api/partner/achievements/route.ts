import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'PARTNER') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const partnerProfile = await prisma.partnerProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        achievements: {
          include: {
            achievement: true
          },
          orderBy: { unlockedAt: 'desc' }
        }
      }
    })

    if (!partnerProfile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const allAchievements = await prisma.achievement.findMany({
      orderBy: { level: 'asc' }
    })

    const unlockedIds = partnerProfile.achievements.map(pa => pa.achievementId)
    
    const achievements = allAchievements.map(achievement => ({
      ...achievement,
      unlocked: unlockedIds.includes(achievement.id),
      unlockedAt: partnerProfile.achievements.find(pa => pa.achievementId === achievement.id)?.unlockedAt
    }))

    return NextResponse.json(achievements)
  } catch (error) {
    console.error('Error fetching achievements:', error)
    return NextResponse.json({ error: 'Error al obtener logros' }, { status: 500 })
  }
}

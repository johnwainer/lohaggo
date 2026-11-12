import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, isActive } = await req.json()

    if (!userId || typeof userId !== 'string' || typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, isActive: true, isSuperAdmin: true, partnerProfile: { select: { id: true } } },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.isSuperAdmin && !admin.isSuperAdmin) {
      return NextResponse.json({ error: 'Solo el administrador de la plataforma puede cambiar a otro administrador de la plataforma' }, { status: 403 })
    }
    if (user.id === admin.id && !isActive) {
      return NextResponse.json({ error: 'No puedes desactivar tu propia cuenta' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive },
    })

    if (user.partnerProfile) {
      await prisma.partnerProfile.update({
        where: { userId },
        data: { isActive },
      })
    }

    await auditAdminAction({
      actorId: admin.id,
      actorEmail: admin.email,
      action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityType: 'User',
      entityId: userId,
      route: '/api/admin/users/toggle-active',
      details: JSON.stringify({ email: user.email, role: user.role, was: user.isActive, now: isActive }),
      request: req,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error toggling user active status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

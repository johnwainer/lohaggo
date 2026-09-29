import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { validateRequest } from '@/lib/validation'
import { userUpdateSchema } from '@/lib/validation/user-schemas'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { pagedResponse, parseAdminPagination } from '@/lib/admin/pagination'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'


const logger = createLogger('admin-users')

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  isActive: true,
  isSuperAdmin: true,
} as const

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const p = parseAdminPagination(searchParams)

    const VALID_ROLES = ['ADMIN', 'PARTNER', 'CLIENT'] as const
    type ValidRole = typeof VALID_ROLES[number]
    if (role && !VALID_ROLES.includes(role as ValidRole)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    }

    const where: Prisma.UserWhereInput = {
      ...(role ? { role: role as ValidRole } : {}),
      ...(p.q
        ? {
            OR: [
              { name: { contains: p.q, mode: 'insensitive' } },
              { email: { contains: p.q, mode: 'insensitive' } },
              { phone: { contains: p.q } },
            ],
          }
        : {}),
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          image: true,
          role: true,
          isActive: true,
          isSuperAdmin: true,
          createdAt: true,
          _count: {
            select: {
              bookings: true,
              serviceRequests: true,
            }
          },
          partnerProfile: {
            select: {
              rating: true,
              totalReviews: true,
              verified: true,
              city: true,
              isActive: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: p.skip,
        take: p.take,
      }),
      p.paged ? prisma.user.count({ where }) : Promise.resolve(0),
    ])

    return NextResponse.json(p.paged ? pagedResponse(users, total, p) : users)
  } catch (error) {
    logger.error('Error fetching users:', error || undefined)
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)

    const validation = await validateRequest(userUpdateSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const { userId, role } = validation.data

    const target = await prisma.user.findUnique({ where: { id: userId }, select: SAFE_USER_SELECT })
    if (!target) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }
    if (target.role === role) {
      return NextResponse.json(target)
    }
    if ((role === 'ADMIN' || target.role === 'ADMIN') && !admin.isSuperAdmin) {
      return NextResponse.json({ error: 'Solo un superadmin puede dar o quitar el rol de administrador' }, { status: 403 })
    }
    if (target.isSuperAdmin) {
      return NextResponse.json({ error: 'No se puede cambiar el rol de un superadmin' }, { status: 403 })
    }
    if (target.id === admin.id) {
      return NextResponse.json({ error: 'No puedes cambiar tu propio rol' }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: SAFE_USER_SELECT,
    })

    await auditAdminAction({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'USER_ROLE_CHANGED',
      entityType: 'User',
      entityId: userId,
      route: '/api/admin/users',
      details: JSON.stringify({ from: target.role, to: role }),
      request,
    })

    return NextResponse.json(user)
  } catch (error) {
    logger.error('Error updating user:', error || undefined)
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 })
  }
}

/** «Eliminar» never hard-deletes (bookings, payments and chats hang from the user): it deactivates. */
export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!admin.isSuperAdmin) {
      return NextResponse.json({ error: 'Solo un superadmin puede eliminar usuarios' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 })
    }
    if (userId === admin.id) {
      return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 })
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { ...SAFE_USER_SELECT, partnerProfile: { select: { id: true } } },
    })
    if (!target) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }
    if (target.isSuperAdmin) {
      return NextResponse.json({ error: 'No se puede eliminar a un superadmin' }, { status: 403 })
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { isActive: false } }),
      ...(target.partnerProfile
        ? [prisma.partnerProfile.update({ where: { userId }, data: { isActive: false } })]
        : []),
    ])

    await auditAdminAction({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'USER_DEACTIVATED',
      entityType: 'User',
      entityId: userId,
      route: '/api/admin/users',
      details: JSON.stringify({ role: target.role, via: 'delete' }),
      request,
    })

    return NextResponse.json({ success: true, deactivated: true })
  } catch (error) {
    logger.error('Error deleting user:', error || undefined)
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 })
  }
}

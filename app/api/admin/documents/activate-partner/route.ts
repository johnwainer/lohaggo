import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications/notificationService'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'

const IDENTITY_TYPES = ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP']

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { partnerId } = await req.json()
  if (!partnerId) return NextResponse.json({ error: 'partnerId requerido' }, { status: 400 })

  const partner = await prisma.partnerProfile.findUnique({
    where: { id: partnerId },
    include: { user: { select: { id: true, name: true } } },
  })
  if (!partner) return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 })

  const approvedIdentity = await prisma.verificationDocument.findFirst({
    where: { partnerId, status: 'APPROVED', type: { in: IDENTITY_TYPES as any } },
  })
  if (!approvedIdentity) {
    return NextResponse.json(
      { error: 'El socio debe tener al menos un documento de identidad aprobado' },
      { status: 400 }
    )
  }

  await prisma.$transaction([
    prisma.partnerProfile.update({
      where: { id: partnerId },
      data: { verified: true, isActive: true },
    }),
    prisma.partnerService.updateMany({
      where: { partnerId },
      data: { active: true },
    }),
  ])

  await createNotification({
    userId: partner.userId,
    type: 'DOCUMENT_APPROVED',
    title: '¡Tu cuenta está verificada!',
    message: 'Tu perfil y servicios ya están activos en la plataforma. ¡Empieza a recibir clientes!',
    data: { partnerId },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'partner.activate',
    entityType: 'PartnerProfile',
    entityId: partnerId,
    route: '/api/admin/documents/activate-partner',
    details: `Activó a ${partner.user.name}`,
    request: req,
  })

  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const logger = createLogger('change-password')

/**
 * POST /api/auth/change-password
 * Authenticated endpoint. Changes the user's password.
 * When coming from a magic-link session (needsPasswordUpdate=true), the
 * currentPassword field is optional — the user may not know their old one.
 * Body: { currentPassword?: string, newPassword: string }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const body = await request.json()
  const { currentPassword, newPassword } = body

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return NextResponse.json(
      { error: 'La nueva contraseña debe tener al menos 8 caracteres.' },
      { status: 400 }
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, password: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
  }

  // If NOT coming from magic link, require current password verification
  if (!session.user.needsPasswordUpdate) {
    if (!currentPassword) {
      return NextResponse.json(
        { error: 'Debes ingresar tu contraseña actual.' },
        { status: 400 }
      )
    }
    const isValid = await bcrypt.compare(currentPassword, user.password)
    if (!isValid) {
      return NextResponse.json({ error: 'La contraseña actual es incorrecta.' }, { status: 400 })
    }
  }

  const hashed = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed },
  })

  logger.info('Password changed', { userId: user.id, viaMagicLink: !!session.user.needsPasswordUpdate })
  return NextResponse.json({ ok: true })
}

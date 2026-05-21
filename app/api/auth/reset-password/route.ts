import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { decode } from "next-auth/jwt"
import { createLogger } from "@/lib/logger"
import { forgotPasswordRateLimiter } from "@/lib/rate-limit"

export const dynamic = 'force-dynamic'

const logger = createLogger('reset-password')

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, newPassword } = body

    if (!token || !newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Token inválido o contraseña demasiado corta (mínimo 8 caracteres).' },
        { status: 400 }
      )
    }

    const secret = process.env.NEXTAUTH_SECRET
    if (!secret) {
      logger.error('NEXTAUTH_SECRET not configured')
      return NextResponse.json({ error: 'Hubo un error al procesar tu solicitud.' }, { status: 500 })
    }

    const decoded = await decode({ token, secret })

    if (!decoded || decoded.intent !== 'reset' || !decoded.email) {
      return NextResponse.json(
        { error: 'El enlace ha caducado o no es válido.' },
        { status: 400 }
      )
    }

    const email = decoded.email as string
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, updatedAt: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'El enlace ha caducado o no es válido.' }, { status: 400 })
    }

    // Single-use check: token embeds updatedAt ms; changes whenever the user record is updated
    if (decoded.ts !== user.updatedAt.getTime()) {
      return NextResponse.json(
        { error: 'El enlace ya fue utilizado o no es válido.' },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12)

    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
      select: { id: true },
    })

    return NextResponse.json({ success: true, message: 'Contraseña actualizada con éxito.' })
  } catch (error) {
    logger.error('Error resetting password', { error })
    return NextResponse.json({ error: 'Hubo un error al procesar tu solicitud.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return forgotPasswordRateLimiter(request, handlePOST)
}

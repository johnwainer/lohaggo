import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { decode } from "next-auth/jwt"

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, newPassword } = body

    if (!token || !newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Token inválido o contraseña demasiado corta (mínimo 8 caracteres).' },
        { status: 400 }
      )
    }

    const secret = process.env.NEXTAUTH_SECRET || "default_secret"
    const decoded = await decode({ token, secret })

    if (!decoded || decoded.intent !== 'reset' || !decoded.email) {
      return NextResponse.json(
        { error: 'El enlace ha caducado o no es válido.' },
        { status: 400 }
      )
    }

    const email = decoded.email as string
    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    }

    // Verify token payload to make sure it's single use
    if (decoded.hash !== user.password.substring(0, 15)) {
      return NextResponse.json(
        { error: 'El enlace ya fue utilizado o no es válido.' },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword }
    })

    return NextResponse.json({ success: true, message: 'Contraseña actualizada con éxito.' })
  } catch (error) {
    console.error('Error resetting password:', error)
    return NextResponse.json({ error: 'Hubo un error al procesar tu solicitud.' }, { status: 500 })
  }
}

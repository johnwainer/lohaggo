import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { encode } from "next-auth/jwt"
import { sendMessageViaProvider } from "@/lib/messaging/providers"
import { getMessagingProviderRuntimeConfig } from "@/lib/messaging/provider-config"
import { createLogger } from "@/lib/logger"
import { forgotPasswordRateLimiter } from "@/lib/rate-limit"

export const dynamic = 'force-dynamic'

const logger = createLogger('forgot-password')

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = body?.email?.trim()?.toLowerCase()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: "Ingresa un correo electrónico válido" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, password: true }
    })

    if (!user) {
      // Return success anyway to avoid email enumeration
      return NextResponse.json({ success: true, message: "Si el correo está registrado, te hemos enviado las instrucciones." })
    }

    const secret = process.env.NEXTAUTH_SECRET
    if (!secret) {
      logger.error('NEXTAUTH_SECRET not configured')
      return NextResponse.json({ error: "Ocurrió un error al procesar la solicitud" }, { status: 500 })
    }

    const token = await encode({
      token: {
        email: user.email,
        intent: "reset",
        hash: user.password.substring(0, 30),
        role: "CLIENT" as any
      },
      secret,
      maxAge: 3600 // 1 hour
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://www.lohaggo.com"
    const resetLink = `${baseUrl}/restablecer-contrasena?token=${token}`

    const runtimeConfig = await getMessagingProviderRuntimeConfig()

    const htmlBody = `
      <div style="font-family: sans-serif; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h1 style="color: #034f8e; margin-top: 0;">Recuperar contraseña</h1>
          <p style="color: #333; font-size: 16px;">Hola ${user.name},</p>
          <p style="color: #333; font-size: 16px;">Hemos recibido una solicitud para restablecer tu contraseña en LoHaggo. Puedes hacerlo haciendo clic en el siguiente botón:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #0a66c2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">Restablecer mi contraseña</a>
          </div>
          <p style="color: #555; font-size: 14px;">Este enlace expirará en 1 hora por motivos de seguridad. Si no solicitaste este cambio, puedes ignorar este correo y tu cuenta seguirá segura.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
          <p style="color: #888; font-size: 12px; margin-bottom: 0;">© ${new Date().getFullYear()} LoHaggo. Si el botón no funciona, copia y pega este enlace en tu navegador: <br/><br/><code style="word-break: break-all; color: #555;">${resetLink}</code></p>
        </div>
      </div>
    `

    const result = await sendMessageViaProvider({
      channel: 'EMAIL',
      to: user.email,
      userId: user.id,
      subject: 'Recuperar contraseña - LoHaggo',
      body: htmlBody
    }, runtimeConfig)

    if (!result.ok) {
      logger.warn('Failed to send password reset email', { userId: user.id, error: result.errorMessage })
    }

    return NextResponse.json({ success: true, message: "Si el correo está registrado, te hemos enviado las instrucciones." })
  } catch (error) {
    logger.error("Forgot password error", { error })
    return NextResponse.json({ error: "Ocurrió un error al procesar la solicitud" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return forgotPasswordRateLimiter(request, handlePOST)
}

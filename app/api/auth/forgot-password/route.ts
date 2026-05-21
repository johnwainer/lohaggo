import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { encode } from "next-auth/jwt"
import { sendMessageViaProvider } from "@/lib/messaging/providers"
import { getMessagingProviderRuntimeConfig } from "@/lib/messaging/provider-config"
import { buildEmailHtml } from "@/lib/email-layout"
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
      select: { id: true, email: true, name: true, updatedAt: true, phone: true }
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
        intent: 'reset',
        // updatedAt changes whenever the user record changes (password reset, profile update)
        // making the token single-use and automatically invalidated after use
        ts: user.updatedAt.getTime(),
        role: 'CLIENT' as const,
      },
      secret,
      maxAge: 3600 // 1 hour
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://www.lohaggo.com"
    const resetLink = `${baseUrl}/restablecer-contrasena?token=${token}`

    const runtimeConfig = await getMessagingProviderRuntimeConfig()

    const htmlBody = buildEmailHtml({
      title: 'Recupera tu contraseña',
      preheader: 'Restablece tu contraseña de LoHaggo — el enlace expira en 1 hora.',
      body: `<p style="margin:0 0 14px;">Hola <strong>${user.name || user.email}</strong>,</p>
<p style="margin:0 0 14px;">Recibimos una solicitud para restablecer la contraseña de tu cuenta en LoHaggo. Haz clic en el botón de abajo para continuar.</p>
<p style="margin:0;">Si no solicitaste este cambio, puedes ignorar este correo — tu cuenta sigue segura.</p>`,
      ctaLabel: 'Restablecer mi contraseña',
      ctaUrl: resetLink,
      footerNote: `El enlace expira en <strong>1 hora</strong>. Si el botón no funciona, copia este enlace:<br/>
<span style="word-break:break-all;color:#64748b;font-size:12px;">${resetLink}</span>`,
    })

    const emailResult = await sendMessageViaProvider({
      channel: 'EMAIL',
      to: user.email,
      userId: user.id,
      subject: 'Recuperar contraseña - LoHaggo',
      body: htmlBody
    }, runtimeConfig)

    if (!emailResult.ok) {
      logger.warn('Failed to send password reset email', { userId: user.id, error: emailResult.errorMessage })

      // SMS fallback when email fails and user has a phone number
      if (user.phone) {
        const smsBody = `LoHaggo: Restablece tu contraseña (válido 1 hora): ${resetLink}`
        const smsResult = await sendMessageViaProvider({
          channel: 'SMS',
          to: user.phone,
          userId: user.id,
          body: smsBody
        }, runtimeConfig)
        if (!smsResult.ok) {
          logger.warn('SMS fallback also failed for password reset', { userId: user.id, error: smsResult.errorMessage })
        } else {
          logger.info('Password reset sent via SMS fallback', { userId: user.id })
        }
      }
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

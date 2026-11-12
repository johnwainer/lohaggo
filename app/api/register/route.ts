import { acquisitionFrom } from '@/lib/analytics/acquisition'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { City } from "@prisma/client"
import bcrypt from "bcryptjs"
import { createLogger } from '@/lib/logger'
import { registerRateLimiter } from '@/lib/rate-limit'
import { validateRequest } from '@/lib/validation'
import { registerSchema } from '@/lib/validation/auth-schemas'
import {
  getClientIpFromHeaders,
  isLikelyBotSubmission,
  verifyTurnstileToken,
} from '@/lib/security/bot-protection'
import { scheduleAutomationsForUser } from '@/lib/messaging/automation-service'
import { signupConsent } from '@/lib/privacy/consent'
import { attachReferral } from '@/lib/referrals/service'
import { normalizePhone, parseColombianMobile, storedPhoneVariants } from '@/lib/phone'
import { isPlaceholderEmail, placeholderEmail } from '@/lib/accounts/phone-login-core'
import { createSessionHandoffToken, deliverPartnerAccessLink, generateStrongPassword, type AccessLinkDelivery } from '@/lib/accounts/partner-signup'

const logger = createLogger('register')

export const dynamic = 'force-dynamic'


// Helper function to normalize city name to enum format
function normalizeCityName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toUpperCase()
    .replace(/\s+/g, '_')
}

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json()

    const validation = await validateRequest(registerSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const {
      email: emailInput,
      phoneProof,
      password,
      name,
      phone,
      role,
      city: citySlug,
      services,
      oficio,
      captchaToken,
      honeypot,
      formStartedAt,
      marketingConsent,
      ref,
    } = validation.data

    if (phone) {
      const mobile = parseColombianMobile(phone)
      if (!mobile.ok) return NextResponse.json({ error: mobile.error }, { status: 400 })
    }

    // Clients always choose their password; a partner without one (/unete) gets a random one and an access link
    const serverPassword = role === 'PARTNER' && !password
    if (!password && !serverPassword) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    if (!formStartedAt) {
      return NextResponse.json(
        { error: 'No fue posible validar el registro. Intenta nuevamente.' },
        { status: 400 }
      )
    }

    if (isLikelyBotSubmission({ honeypot, formStartedAt })) {
      return NextResponse.json(
        { error: 'No fue posible validar el registro. Intenta nuevamente.' },
        { status: 400 }
      )
    }

    const isCaptchaValid = await verifyTurnstileToken({
      token: captchaToken,
      remoteIp: getClientIpFromHeaders(request.headers),
      expectedAction: 'register',
    })

    if (!isCaptchaValid) {
      return NextResponse.json(
        { error: 'Verificación anti-bot inválida. Intenta de nuevo.' },
        { status: 400 }
      )
    }

    // Without email (only a partner from /unete): the account takes the placeholder address and the phone must
    // be proven below with a WhatsApp code, because placeholder accounts sign in by phone
    // A typed placeholder address would skip the proof that goes with it
    if (isPlaceholderEmail(emailInput)) return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    let email = emailInput ?? ''
    let proofPhone: string | null = null
    if (!email) {
      const { phoneE164, HAS_ACCOUNT_ERROR, phoneProofValid } = await import('@/lib/accounts/phone-login')
      const e164 = phone ? phoneE164(phone) : null
      if (role !== 'PARTNER' || !serverPassword || !e164) {
        return NextResponse.json({ error: 'El correo es obligatorio' }, { status: 400 })
      }
      // Without a valid proof nothing about the number is revealed (a taken number can never have one: /prove refuses it)
      if (!phoneProofValid(phoneProof, e164)) {
        return NextResponse.json(
          { error: 'Confirma tu número con el código de WhatsApp para registrarte sin correo.', code: 'phone_proof_required' },
          { status: 403 }
        )
      }
      const taken = await prisma.user.count({ where: { phone: { in: storedPhoneVariants(e164) } } })
      if (taken > 0) {
        return NextResponse.json({ error: HAS_ACCOUNT_ERROR, code: 'phone_has_account' }, { status: 409 })
      }
      email = placeholderEmail(e164)
      proofPhone = e164
    }

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "El email ya está registrado" },
        { status: 400 }
      )
    }

    // Si es socio y se proporcionó ciudad, validar y convertir slug a enum
    let cityEnum: City = City.MEDELLIN
    if (role === "PARTNER" && citySlug) {
      const cityRecord = await prisma.cityConfig.findUnique({
        where: { slug: citySlug }
      })

      if (!cityRecord) {
        return NextResponse.json(
          { error: "Ciudad no válida" },
          { status: 400 }
        )
      }

      const cityName = normalizeCityName(cityRecord.name)

      logger.info('Normalizing city name', {
        slug: citySlug,
        originalName: cityRecord.name,
        normalizedName: cityName,
        availableEnumValues: Object.keys(City)
      })

      // Validar que el nombre normalizado existe en el enum City
      if (!(cityName in City)) {
        logger.error('City name not found in enum', {
          originalName: cityRecord.name,
          normalizedName: cityName,
          availableValues: Object.keys(City)
        })
        return NextResponse.json(
          { error: "Ciudad no soportada en el sistema" },
          { status: 400 }
        )
      }

      cityEnum = cityName as City
    }

    // The proof is spent only now, after every other check, so a typo above does not burn it
    if (proofPhone) {
      const { consumePhoneProof } = await import('@/lib/accounts/phone-login')
      if (!(await consumePhoneProof(phoneProof, proofPhone))) {
        return NextResponse.json(
          { error: 'Confirma tu número con el código de WhatsApp para registrarte sin correo.', code: 'phone_proof_required' },
          { status: 403 }
        )
      }
    }

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(password || generateStrongPassword(), 10)

    // Crear usuario
    const userData: any = {
      email,
      password: hashedPassword,
      name,
      phone: normalizePhone(phone),
      role: role || "CLIENT",
      ...(proofPhone ? { phoneVerifiedAt: new Date() } : {}),
    }

    // Si es socio, crear perfil de socio con ciudad y servicios
    if (role === "PARTNER") {
      userData.partnerProfile = {
        create: {
          bio: "",
          rating: 0,
          totalReviews: 0,
          verified: false,
          city: cityEnum,
        }
      }
    }

    const acquisition = acquisitionFrom(request, body)
    const user = await prisma.user.create({
      data: { ...userData, ...(acquisition ? { acquisition } : {}), ...signupConsent({ marketing: marketingConsent === true }) },
      include: {
        partnerProfile: true
      }
    })

    if (ref) await attachReferral(user.id, ref).catch((err) => logger.warn('attachReferral failed', { userId: user.id, err }))

    // Si es socio y tiene servicios seleccionados, crear las relaciones
    // oficio is now an array of service names from the DB
    const oficioNames: string[] = Array.isArray(oficio) ? oficio : []

    if (role === "PARTNER" && user.partnerProfile && (oficioNames.length > 0 || (services ?? []).length > 0)) {
      const bySlug = (services ?? []).length > 0
        ? await prisma.service.findMany({ where: { slug: { in: services } } })
        : []
      const byName = oficioNames.length > 0
        ? await prisma.service.findMany({ where: { name: { in: oficioNames } } })
        : []

      const seen = new Set<string>()
      const serviceRecords = [...bySlug, ...byName].filter((s) => {
        if (seen.has(s.id)) return false
        seen.add(s.id)
        return true
      })

      // Crear las relaciones PartnerService
      const partnerServices = serviceRecords.map((service: { id: string; basePrice: number }) => ({
        partnerId: user.partnerProfile!.id,
        serviceId: service.id,
        price: service.basePrice,
        city: cityEnum,
        active: true,
      }))

      if (partnerServices.length > 0) {
        await prisma.partnerService.createMany({
          data: partnerServices,
          skipDuplicates: true,
        })
      }
    }

    // B1 / C1 by WhatsApp template. A partner signed up without a password gets C1 with the access link
    // from deliverPartnerAccessLink below; the others get a button to their panel.
    if (phone && !(role === 'PARTNER' && serverPassword)) {
      const { waAccountCreated } = await import('@/lib/messaging/wa-events')
      await waAccountCreated({ userId: user.id, role: role === 'PARTNER' ? 'PARTNER' : 'CLIENT', name, suffix: role === 'PARTNER' ? 'partner/verification' : 'dashboard' })
    }

    // Schedule all active automation rules for this user's role
    const automationTrigger = role === 'PARTNER' ? 'PARTNER_REGISTERED' : 'CLIENT_REGISTERED'
    scheduleAutomationsForUser(user.id, automationTrigger).catch((err) =>
      logger.error('scheduleAutomations failed', { userId: user.id, err })
    )

    // Schedule docs reminder for partners (delayHours is set in the rule)
    if (role === 'PARTNER') {
      scheduleAutomationsForUser(user.id, 'PARTNER_DOCS_REMINDER').catch(() => null)
      scheduleAutomationsForUser(user.id, 'PARTNER_REFERRAL_REMINDER').catch(() => null)
    } else {
      scheduleAutomationsForUser(user.id, 'CLIENT_FIRST_BOOKING_NUDGE').catch(() => null)
      scheduleAutomationsForUser(user.id, 'CLIENT_REFERRAL_REMINDER').catch(() => null)
    }

    let partnerAccess: { sessionToken: string; accessLinkSent: AccessLinkDelivery } | null = null
    if (serverPassword) {
      const [accessLinkSent, sessionToken] = await Promise.all([
        deliverPartnerAccessLink({ id: user.id, email: user.email, name: user.name, phone: user.phone }),
        createSessionHandoffToken(user.id),
      ])
      partnerAccess = { sessionToken, accessLinkSent }
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      ...(partnerAccess ?? {}),
    }, { status: 201 })
  } catch (error) {
    logger.error('Error registering user', { error })
    return NextResponse.json(
      { error: "Error al registrar usuario" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return registerRateLimiter(request, handlePOST);
}

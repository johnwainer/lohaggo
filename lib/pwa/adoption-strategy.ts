import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const MIN_PROMPT_INTERVAL_HOURS = Number(process.env.PWA_PROMPT_MIN_INTERVAL_HOURS || 36)
const PROMPT_MAX_ATTEMPTS = Number(process.env.PWA_PROMPT_MAX_ATTEMPTS_14D || 3)
const PROMPT_WINDOW_DAYS = Number(process.env.PWA_PROMPT_WINDOW_DAYS || 14)
const DEPRIORITIZE_AFTER_DISMISSES = Number(process.env.PWA_PROMPT_DISMISSES_FOR_DEPRIORITIZE || 2)
const DEPRIORITIZE_DAYS = Number(process.env.PWA_PROMPT_DEPRIORITIZE_DAYS || 7)
const CONTEXT_LOOKBACK_HOURS = Number(process.env.PWA_CONTEXT_LOOKBACK_HOURS || 72)

type PromptStage = 'INSTALL' | 'PUSH'
type PromptFormat = 'BANNER' | 'CARD'

type PromptContext =
  | 'CLIENT_REQUEST_CREATED'
  | 'CLIENT_PROPOSAL_RECEIVED'
  | 'PARTNER_LEAD_RECEIVED'
  | 'PARTNER_BOOKING_STATUS_CHANGED'

const CLIENT_CONTEXTS: PromptContext[] = ['CLIENT_REQUEST_CREATED', 'CLIENT_PROPOSAL_RECEIVED']
const PARTNER_CONTEXTS: PromptContext[] = ['PARTNER_LEAD_RECEIVED', 'PARTNER_BOOKING_STATUS_CHANGED']

const CONTEXT_EVENT_TO_NAME: Record<PromptContext, string> = {
  CLIENT_REQUEST_CREATED: 'context_client_request_created',
  CLIENT_PROPOSAL_RECEIVED: 'context_client_proposal_received',
  PARTNER_LEAD_RECEIVED: 'context_partner_lead_received',
  PARTNER_BOOKING_STATUS_CHANGED: 'context_partner_booking_status_changed',
}

const CONTEXT_NAME_TO_EVENT = Object.fromEntries(
  Object.entries(CONTEXT_EVENT_TO_NAME).map(([key, value]) => [value, key as PromptContext])
) as Record<string, PromptContext>

export function isContextEventName(eventName: string) {
  return Boolean(CONTEXT_NAME_TO_EVENT[eventName])
}

export function mapContextEventName(eventName: string): PromptContext | null {
  return CONTEXT_NAME_TO_EVENT[eventName] || null
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000)
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function hashVariant(userId: string): 'A' | 'B' {
  let hash = 0
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash << 5) - hash + userId.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % 2 === 0 ? 'A' : 'B'
}

async function ensureProfile(userId: string) {
  const variant = hashVariant(userId)
  return prisma.pwaAdoptionProfile.upsert({
    where: { userId },
    create: { userId, abVariant: variant },
    update: { abVariant: { set: variant } },
  })
}

export async function recordPromptContext(userId: string, context: PromptContext, metadata?: Record<string, unknown>) {
  const now = new Date()
  const profile = await ensureProfile(userId)
  const shouldDedupe =
    profile.lastContext === context &&
    profile.lastContextAt &&
    profile.lastContextAt > addHours(now, -3)

  if (!shouldDedupe) {
    await prisma.pwaTelemetryEvent.create({
      data: {
        userId,
        eventName: CONTEXT_EVENT_TO_NAME[context],
        source: 'context_trigger',
        metadata: metadata ? JSON.stringify(metadata).slice(0, 6000) : null,
      },
    })
  }

  await prisma.pwaAdoptionProfile.update({
    where: { userId },
    data: {
      lastContext: context,
      lastContextAt: now,
    },
  })
}

export async function syncProfileFromPwaEvent(userId: string, eventName: string) {
  const now = new Date()
  const data: Record<string, unknown> = {}

  if (eventName === 'pwa_installed') {
    data.installedAt = now
    data.nextEligibleAt = addHours(now, 12)
    data.consecutiveDismisses = 0
  }

  if (eventName === 'push_subscription_created') {
    data.pushEnabledAt = now
    data.consecutiveDismisses = 0
    data.nextEligibleAt = null
  }

  const context = mapContextEventName(eventName)
  if (context) {
    data.lastContext = context
    data.lastContextAt = now
  }

  if (Object.keys(data).length === 0) return

  await prisma.$transaction(async (tx) => {
    await tx.pwaAdoptionProfile.upsert({
      where: { userId },
      create: {
        userId,
        abVariant: hashVariant(userId),
        ...data,
      },
      update: data,
    })

    if (eventName === 'pwa_installed') {
      await (tx as any).user.update({
        where: { id: userId },
        data: {
          notificationsPushEnabled: true,
          notificationsEmailEnabled: true,
          notificationsWhatsappEnabled: true,
          notificationsSmsEnabled: true,
        },
      })

      await tx.messagingOptOut.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      })
    }
  })
}

export async function markPromptInteraction(userId: string, action: 'shown' | 'dismissed' | 'install_clicked' | 'push_clicked', stage: PromptStage) {
  const now = new Date()
  const profile = await ensureProfile(userId)

  const windowStart = profile.promptWindowStartAt && profile.promptWindowStartAt > addDays(now, -PROMPT_WINDOW_DAYS)
    ? profile.promptWindowStartAt
    : now

  const shouldResetWindow = !profile.promptWindowStartAt || profile.promptWindowStartAt <= addDays(now, -PROMPT_WINDOW_DAYS)
  const attemptsInWindow = shouldResetWindow ? 0 : profile.promptAttemptsWindow

  if (action === 'shown') {
    await prisma.pwaAdoptionProfile.update({
      where: { userId },
      data: {
        promptWindowStartAt: windowStart,
        promptAttemptsWindow: attemptsInWindow + 1,
        lastPromptAt: now,
        lastStageShown: stage,
      },
    })
    return
  }

  if (action === 'dismissed') {
    const nextDismisses = profile.consecutiveDismisses + 1
    const shouldDeprioritize = nextDismisses >= DEPRIORITIZE_AFTER_DISMISSES

    await prisma.pwaAdoptionProfile.update({
      where: { userId },
      data: {
        consecutiveDismisses: shouldDeprioritize ? 0 : nextDismisses,
        nextEligibleAt: addHours(now, MIN_PROMPT_INTERVAL_HOURS),
        deprioritizedUntil: shouldDeprioritize ? addDays(now, DEPRIORITIZE_DAYS) : profile.deprioritizedUntil,
      },
    })
    return
  }

  await prisma.pwaAdoptionProfile.update({
    where: { userId },
    data: {
      nextEligibleAt: addHours(now, 12),
      consecutiveDismisses: 0,
    },
  })
}

function getPromptCopy(role: UserRole, stage: PromptStage, variant: 'A' | 'B') {
  const copy = {
    CLIENT: {
      INSTALL: variant === 'A'
        ? {
            title: 'Instala LoHaggo y sigue tus servicios en segundos',
            description: 'Recibe todo el estado de tus reservas y propuestas desde el inicio de tu celular.',
            cta: 'Instalar app',
          }
        : {
            title: 'Guarda LoHaggo como app y responde más rápido',
            description: 'Verás nuevas propuestas y cambios de reserva sin buscar el navegador.',
            cta: 'Agregar a inicio',
          },
      PUSH: variant === 'A'
        ? {
            title: 'Activa notificaciones para no perder ofertas',
            description: 'Te avisamos cuando llegue una propuesta o cambie el estado de tu servicio.',
            cta: 'Activar notificaciones',
          }
        : {
            title: 'Tus reservas en tiempo real',
            description: 'Habilita alertas push y evita retrasos en respuestas y confirmaciones.',
            cta: 'Quiero alertas',
          },
    },
    PARTNER: {
      INSTALL: variant === 'A'
        ? {
            title: 'Instala LoHaggo y atiende leads más rápido',
            description: 'Recibe solicitudes nuevas al instante y mejora tu tiempo de respuesta.',
            cta: 'Instalar app',
          }
        : {
            title: 'Convierte más con la app instalada',
            description: 'Tendrás acceso directo a leads y cambios de estado desde el home de tu celular.',
            cta: 'Agregar a inicio',
          },
      PUSH: variant === 'A'
        ? {
            title: 'Activa push para no perder solicitudes',
            description: 'Te avisamos de nuevos leads, mensajes y actualizaciones de reservas.',
            cta: 'Activar notificaciones',
          }
        : {
            title: 'Responde primero y gana más',
            description: 'Con alertas push reaccionas antes que otros socios y aumentas conversiones.',
            cta: 'Habilitar alertas',
          },
    },
  }

  const roleKey = role === 'PARTNER' ? 'PARTNER' : 'CLIENT'
  return copy[roleKey][stage]
}

export async function getNextPwaPrompt(userId: string, role: UserRole) {
  const now = new Date()
  const profile = await ensureProfile(userId)

  const windowStart = profile.promptWindowStartAt && profile.promptWindowStartAt > addDays(now, -PROMPT_WINDOW_DAYS)
    ? profile.promptWindowStartAt
    : now

  const attemptsInWindow = profile.promptWindowStartAt && profile.promptWindowStartAt > addDays(now, -PROMPT_WINDOW_DAYS)
    ? profile.promptAttemptsWindow
    : 0

  if (!profile.promptWindowStartAt || profile.promptWindowStartAt <= addDays(now, -PROMPT_WINDOW_DAYS)) {
    await prisma.pwaAdoptionProfile.update({
      where: { userId },
      data: {
        promptWindowStartAt: windowStart,
        promptAttemptsWindow: attemptsInWindow,
      },
    })
  }

  const stage: PromptStage | null = !profile.installedAt ? 'INSTALL' : !profile.pushEnabledAt ? 'PUSH' : null
  if (!stage) {
    return { shouldShow: false, reason: 'completed_funnel' }
  }

  if (profile.deprioritizedUntil && profile.deprioritizedUntil > now) {
    return { shouldShow: false, reason: 'deprioritized' }
  }

  if (profile.nextEligibleAt && profile.nextEligibleAt > now) {
    return { shouldShow: false, reason: 'cooldown' }
  }

  if (profile.lastPromptAt && profile.lastPromptAt > addHours(now, -MIN_PROMPT_INTERVAL_HOURS)) {
    return { shouldShow: false, reason: 'min_interval' }
  }

  if (attemptsInWindow >= PROMPT_MAX_ATTEMPTS) {
    return { shouldShow: false, reason: 'window_attempt_limit' }
  }

  const lastContext = profile.lastContext as PromptContext | null
  const contextAllowed = role === 'PARTNER' ? PARTNER_CONTEXTS : CLIENT_CONTEXTS

  if (!lastContext || !contextAllowed.includes(lastContext)) {
    return { shouldShow: false, reason: 'missing_context' }
  }

  if (!profile.lastContextAt || profile.lastContextAt < addHours(now, -CONTEXT_LOOKBACK_HOURS)) {
    return { shouldShow: false, reason: 'stale_context' }
  }

  const format: PromptFormat = profile.abVariant === 'A' ? 'BANNER' : 'CARD'
  const variant = profile.abVariant === 'B' ? 'B' : 'A'

  return {
    shouldShow: true,
    stage,
    variant,
    format,
    context: lastContext,
    attemptsInWindow,
    ...getPromptCopy(role, stage, variant),
  }
}

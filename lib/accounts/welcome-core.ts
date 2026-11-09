/**
 * Welcome for clients who signed up and asked for nothing: «¿Qué necesitas arreglar?» 24 h after signing
 * up, and one reminder at 3 days. Pure timing rules (the runner is lib/accounts/welcome.ts).
 */

export const WELCOME_KEY = 'client_welcome'
export const HOUR_MS = 3600_000

export const WELCOME_STEPS = [
  /** 24 h after signup; skipped once the 3-day reminder is due */
  { step: 1, fromHours: 24, untilHours: 72 },
  /** 3 days after signup; accounts older than two weeks are left alone */
  { step: 2, fromHours: 72, untilHours: 14 * 24 },
] as const

export type WelcomeStep = (typeof WELCOME_STEPS)[number]['step']

/** Two welcome messages never go out closer than this */
export const MIN_GAP_HOURS = 36

export type WelcomeInput = {
  createdAt: Date
  now: Date
  /** Steps already sent to this person, with when */
  sent: Array<{ step: number; at: Date }>
  /** A request or a booking, ever */
  hasActivity: boolean
  excludedFromMarketing: boolean
  isActive: boolean
  role: string
}

/** Which welcome step goes out now, or null. */
export function welcomeStepDue(p: WelcomeInput): WelcomeStep | null {
  if (p.role !== 'CLIENT' || !p.isActive || p.excludedFromMarketing || p.hasActivity) return null
  const ageH = (p.now.getTime() - p.createdAt.getTime()) / HOUR_MS
  const last = p.sent.reduce<Date | null>((acc, s) => (!acc || s.at > acc ? s.at : acc), null)
  if (last && (p.now.getTime() - last.getTime()) / HOUR_MS < MIN_GAP_HOURS) return null
  for (const s of WELCOME_STEPS) {
    if (ageH >= s.fromHours && ageH < s.untilHours && !p.sent.some((x) => x.step >= s.step)) return s.step
  }
  return null
}

/** Signup window the runner scans (both steps): from 14 days ago to 24 h ago. */
export function welcomeScanRange(now: Date) {
  return { gte: new Date(now.getTime() - WELCOME_STEPS[1].untilHours * HOUR_MS), lte: new Date(now.getTime() - WELCOME_STEPS[0].fromHours * HOUR_MS) }
}

export type PopularService = { name: string; slug: string }

export function welcomeCopy(step: WelcomeStep, firstName: string, services: PopularService[]) {
  const list = services.map((s) => s.name).join(', ')
  if (step === 1) {
    return {
      title: '¿Qué necesitas arreglar?',
      message: `${firstName}, cuéntanos qué necesitas en casa y te llegan propuestas de socios verificados.${list ? ` Lo más pedido: ${list}.` : ''}`,
      subject: `${firstName}, ¿qué necesitas arreglar en casa?`,
    }
  }
  return {
    title: 'Tu primera solicitud toma 1 minuto',
    message: `${firstName}, pedir no tiene costo: varios socios te envían propuestas y tú comparas precio y calificación antes de elegir.${list ? ` Lo más pedido: ${list}.` : ''}`,
    subject: `${firstName}, tu primera solicitud en LoHaggo toma 1 minuto`,
  }
}

import { z } from 'zod'

/** Ley 1581: consultas y reclamos se responden en 15 días hábiles */
export const DATA_REQUEST_BUSINESS_DAYS = 15

export const DATA_REQUEST_TYPES = ['ACCESS', 'DELETE', 'CORRECT'] as const
export type DataRequestKind = (typeof DATA_REQUEST_TYPES)[number]
export const DATA_REQUEST_LABEL: Record<DataRequestKind, string> = {
  ACCESS: 'Conocer mis datos',
  DELETE: 'Eliminar mis datos',
  CORRECT: 'Corregir mis datos',
}

export const DATA_REQUEST_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'] as const
export type DataRequestState = (typeof DATA_REQUEST_STATUSES)[number]

/** Monday to Friday only (holidays are not modelled: the team's deadline is never later than the legal one by much, and never earlier). */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from)
  let left = days
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    const wd = d.getUTCDay()
    if (wd !== 0 && wd !== 6) left--
  }
  return d
}

export const dueAtFor = (createdAt: Date) => addBusinessDays(createdAt, DATA_REQUEST_BUSINESS_DAYS)

/** Calendar days left to the deadline (negative = overdue) and a label for the card. */
export function dueCountdown(dueAt: Date | string, now = new Date()) {
  const ms = new Date(dueAt).getTime() - now.getTime()
  const days = Math.ceil(ms / 86_400_000)
  const label = ms < 0 ? `Vencida hace ${Math.max(1, Math.abs(Math.floor(ms / 86_400_000)))} d` : days === 0 ? 'Vence hoy' : `Quedan ${days} d`
  const tone: 'overdue' | 'soon' | 'ok' = ms < 0 ? 'overdue' : days <= 3 ? 'soon' : 'ok'
  return { days, label, tone, overdue: ms < 0 }
}

export const dataRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email('Escribe un correo válido').max(160),
  name: z.string().trim().max(120).optional(),
  type: z.enum(DATA_REQUEST_TYPES),
  message: z.string().trim().max(2000).optional(),
  honeypot: z.string().optional(),
})

export type DataRequestInput = z.infer<typeof dataRequestSchema>

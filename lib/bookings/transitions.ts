/**
 * The booking state machine, pure: shared by the server (lib/bookings/ops.ts) and the admin screen, which
 * only offers the transitions a person may make from the current state. No server imports.
 */
import type { BookingStatus } from '@prisma/client'
import type { Actor } from '@/lib/ops/origin'

export type TransitionRole = 'client' | 'partner' | 'admin'

export const BOOKING_TRANSITIONS: Record<BookingStatus, { to: BookingStatus; by: TransitionRole[] }[]> = {
  PENDING: [
    { to: 'CONFIRMED', by: ['partner', 'admin'] },
    { to: 'CANCELLED', by: ['client', 'partner', 'admin'] },
  ],
  CONFIRMED: [
    { to: 'IN_PROGRESS', by: ['partner', 'admin'] },
    { to: 'CANCELLED', by: ['client', 'partner', 'admin'] },
  ],
  IN_PROGRESS: [
    { to: 'COMPLETED', by: ['partner', 'admin'] },
    { to: 'CANCELLED', by: ['admin'] },
  ],
  COMPLETED: [],
  CANCELLED: [],
}

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: 'Pendiente de confirmación',
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
}

const ROLE_LABEL: Record<TransitionRole, string> = { client: 'el cliente', partner: 'el socio', admin: 'un administrador' }

export function transitionRoleOf(actor: Pick<Actor, 'role'>): TransitionRole {
  return actor.role === 'ADMIN' ? 'admin' : actor.role === 'PARTNER' ? 'partner' : 'client'
}

export function canTransition(from: BookingStatus, to: BookingStatus, role: TransitionRole): { ok: true } | { ok: false; reason: string } {
  if (from === to) return { ok: false, reason: `La reserva ya está ${BOOKING_STATUS_LABEL[to].toLowerCase()}` }
  const options = BOOKING_TRANSITIONS[from]
  if (!options.length) return { ok: false, reason: `Una reserva ${BOOKING_STATUS_LABEL[from].toLowerCase()} ya no cambia de estado` }
  const option = options.find((o) => o.to === to)
  if (!option) return { ok: false, reason: `Una reserva ${BOOKING_STATUS_LABEL[from].toLowerCase()} no puede pasar a ${BOOKING_STATUS_LABEL[to].toLowerCase()}` }
  if (!option.by.includes(role)) {
    const who = option.by.map((r) => ROLE_LABEL[r]).join(' o ')
    return { ok: false, reason: `Solo ${who} puede pasar la reserva a ${BOOKING_STATUS_LABEL[to].toLowerCase()}` }
  }
  return { ok: true }
}

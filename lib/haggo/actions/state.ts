/** Lifecycle of a HaggoAction. Pure: the engine asks here before every status change. */

export type ActionStatus = 'proposed' | 'blocked' | 'approved' | 'executing' | 'executed' | 'failed' | 'rejected' | 'expired' | 'reverted'
export type ActionEvent = 'approve' | 'reject' | 'expire' | 'start' | 'succeed' | 'fail' | 'revert'

const TRANSITIONS: Record<ActionStatus, Partial<Record<ActionEvent, ActionStatus>>> = {
  proposed: { approve: 'approved', reject: 'rejected', expire: 'expired', fail: 'failed' },
  approved: { start: 'executing', fail: 'failed' },
  executing: { succeed: 'executed', fail: 'failed' },
  executed: { revert: 'reverted' },
  blocked: {},
  failed: {},
  rejected: {},
  expired: {},
  reverted: {},
}

export function nextStatus(from: ActionStatus, event: ActionEvent): ActionStatus | null {
  return TRANSITIONS[from]?.[event] ?? null
}

export const STATUS_LABEL: Record<ActionStatus, string> = {
  proposed: 'Por aprobar',
  blocked: 'Bloqueada',
  approved: 'Aprobada',
  executing: 'Ejecutando',
  executed: 'Ejecutada',
  failed: 'Falló',
  rejected: 'Rechazada',
  expired: 'Caducó',
  reverted: 'Deshecha',
}

export const OPEN_STATUSES: ActionStatus[] = ['proposed', 'approved', 'executing']

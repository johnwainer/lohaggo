/**
 * Pure rules for what an inbox AI agent may do on the platform from a chat: which tools need the person's
 * explicit yes, how long a proposed action stays valid, and how many times a day a conversation can do
 * each thing. Shared by the server and the admin screen (no server imports).
 */

/** A proposed action the person has not confirmed yet is forgotten after this long. */
export const CONFIRM_WINDOW_MS = 15 * 60_000

export type ActionStatus = 'proposed' | 'awaiting_approval' | 'executed' | 'failed' | 'rejected' | 'expired'

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  proposed: 'Esperando que la persona confirme',
  awaiting_approval: 'Esperando aprobación del equipo',
  executed: 'Hecha',
  failed: 'Falló',
  rejected: 'Rechazada',
  expired: 'Vencida',
}

/** Tool groups as the agent screen shows them. */
export const TOOL_GROUPS = {
  inbox: 'Bandeja',
  identity: 'Identidad de la persona',
  client: 'Clientes: pedir y gestionar servicios',
  payments: 'Pagos y calificación',
  partner: 'Socios: proponer y gestionar reservas',
  partner_profile: 'Perfil del socio',
} as const
export type ToolGroup = keyof typeof TOOL_GROUPS

/** Per conversation per day. Beyond these the agent hands the conversation to a person. */
export const DAILY_ACTION_LIMITS: Record<string, number> = {
  crear_solicitud: 3,
  enviar_propuesta: 5,
  aceptar_propuesta: 3,
  cancelar_reserva: 2,
  reprogramar_reserva: 3,
  cambiar_estado_reserva: 8,
  reportar_pago: 3,
  confirmar_pago: 5,
  rechazar_pago: 2,
  calificar: 3,
  gestionar_servicio: 5,
  vincular_cuenta: 3,
  registrar_cuenta_bancaria: 2,
  subir_documento: 6,
}

export function dailyLimitFor(tool: string) {
  return DAILY_ACTION_LIMITS[tool] ?? null
}

/**
 * Whether a confirming call may run. The model says `confirmado: true` only after the person said yes;
 * the server still requires a proposal of the same tool in the window, so a yes cannot be invented in one
 * turn without first showing the person what will happen.
 */
export function confirmationGate(p: { confirmado: boolean; proposedAt: Date | null; sameInput?: boolean; now?: Date }): 'ask' | 'run' | 'stale' | 'mismatch' {
  if (!p.confirmado) return 'ask'
  if (!p.proposedAt) return 'stale'
  const now = p.now ?? new Date()
  if (now.getTime() - p.proposedAt.getTime() > CONFIRM_WINDOW_MS) return 'stale'
  return p.sameInput === false ? 'mismatch' : 'run'
}

/** The proposal and its confirmation must be about the same thing: same input, apart from the yes itself. */
export function sameActionInput(a: unknown, b: unknown) {
  const norm = (v: unknown) => {
    const o = v && typeof v === 'object' ? { ...(v as Record<string, unknown>) } : {}
    delete o.confirmado
    return JSON.stringify(Object.keys(o).sort().map((k) => [k, typeof o[k] === 'string' ? (o[k] as string).trim() : o[k]]))
  }
  return norm(a) === norm(b)
}

export const MISMATCH_CONFIRMATION_TEXT = 'Lo que confirmas no coincide con lo que se le propuso a la persona. Vuelve a llamar la herramienta con confirmado: false y los datos nuevos para proponérselo, y espera su sí.'

/** What the model reads back when an action waits for the person's yes. */
export function askConfirmationText(summary: string) {
  return `Acción pendiente de confirmación: ${summary}. Resúmele a la persona exactamente esto y pregúntale si confirma. Solo cuando responda claramente que sí, vuelve a llamar la herramienta con confirmado: true y los mismos datos. Si dice que no o cambia algo, no la llames.`
}

export const STALE_CONFIRMATION_TEXT = 'No hay una acción propuesta reciente que confirmar. Primero llama la herramienta con confirmado: false para presentarle a la persona lo que vas a hacer, espera su sí, y entonces confirma.'

export const LIMIT_REACHED_TEXT = 'Esta conversación ya alcanzó el máximo de veces que se puede hacer esto hoy. No lo intentes de nuevo: explícale a la persona que una persona del equipo continuará y traspasa la conversación.'

/** Copilot: the tool call becomes a proposal a person approves from the inbox. */
export function awaitingApprovalText(summary: string) {
  return `Acción registrada para que el equipo la apruebe desde la bandeja: ${summary}. No le digas a la persona que ya está hecha; dile que el equipo la revisará en breve.`
}

/** Playground: nothing is written; the model learns what would happen. */
export function dryRunText(summary: string, wouldRecord: string, confirmed = true) {
  return confirmed
    ? `Hecho (simulado en pruebas, nada se escribió): ${summary}. En producción quedaría registrado ${wouldRecord}, con origen «chat». Dile a la persona que quedó listo, como harías en producción.`
    : `Simulado en pruebas: ${summary}. En producción quedaría registrado ${wouldRecord}, con origen «chat». Resúmele esto a la persona y pídele confirmación; con su sí, vuelve a llamar con confirmado: true.`
}

const FMT = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
export const cop = (n: number) => FMT.format(Math.round(n))

/** Short ids for people: last 6 characters, like the CRM module does. */
export const shortId = (id: string) => id.slice(-6)

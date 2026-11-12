/**
 * Push permission is asked when it has an obvious reason, never on a timer: right after the client sends a
 * request («Avísame aquí cuando llegue la primera propuesta») and right after a partner sends a proposal.
 * Screens call askForPush(); NotificationPermissionPrompt listens and shows the ask through the prompt slot.
 */
export const PUSH_ASK_EVENT = 'lohaggo:push-ask'

export type PushAskReason = 'request_sent' | 'proposal_sent'

export const PUSH_ASK_COPY: Record<PushAskReason, { title: string; body: string }> = {
  request_sent: { title: 'Avísame aquí cuando llegue la primera propuesta', body: 'Un aviso en tu celular, sin abrir la app.' },
  proposal_sent: { title: 'Avísame cuando el cliente responda', body: 'Entérate al instante si te eligen o te escriben.' },
}

export function askForPush(reason: PushAskReason) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PUSH_ASK_EVENT, { detail: { reason } }))
}

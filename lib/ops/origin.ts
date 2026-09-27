/**
 * Where a platform action came from. Every shared operation (lib/*\/ops.ts) receives one and stamps it on
 * the rows it creates, so the app, an inbox AI agent (chat) and the admin leave the same records, and a
 * person can always see «this was done by agent X over WhatsApp» and jump to that conversation. Pure.
 */

export type OriginVia = 'app' | 'chat' | 'admin'

export type Origin = {
  via: OriginVia
  /** Chat only: WHATSAPP, SMS, MESSENGER, INSTAGRAM… */
  channel?: string | null
  conversationId?: string | null
  agentId?: string | null
  agentName?: string | null
}

export const APP_ORIGIN: Origin = { via: 'app' }
export const ADMIN_ORIGIN: Origin = { via: 'admin' }

export function chatOrigin(p: { channel: string; conversationId: string; agentId: string; agentName?: string | null }): Origin {
  return { via: 'chat', channel: p.channel, conversationId: p.conversationId, agentId: p.agentId, agentName: p.agentName ?? null }
}

/** The four columns every origin-aware model has, ready to spread into a Prisma create. */
export function originColumns(o: Origin) {
  return {
    origin: o.via,
    originChannel: o.via === 'chat' ? (o.channel ?? null) : null,
    originConversationId: o.via === 'chat' ? (o.conversationId ?? null) : null,
    originAgentId: o.via === 'chat' ? (o.agentId ?? null) : null,
  }
}

/** Who acts: the platform user (client or partner) on whose behalf, and, for admin, the admin. */
export type Actor = {
  userId: string
  role: 'CLIENT' | 'PARTNER' | 'ADMIN'
  /** PartnerProfile.id when the actor is a partner */
  partnerId?: string | null
  email?: string | null
}

/** BookingEvent.actorType from an actor and origin. */
export function actorTypeOf(actor: Actor, origin: Origin): 'client' | 'partner' | 'admin' | 'ai' {
  if (origin.via === 'chat') return 'ai'
  if (actor.role === 'ADMIN') return 'admin'
  return actor.role === 'PARTNER' ? 'partner' : 'client'
}

/** Text for audit details and system notes: «por chat (WhatsApp, agente Sofía)». */
export function describeOrigin(o: Origin) {
  if (o.via === 'chat') return `por chat (${channelLabel(o.channel)}${o.agentName ? `, agente ${o.agentName}` : ''})`
  return o.via === 'admin' ? 'desde el admin' : 'desde la app'
}

export function channelLabel(channel?: string | null) {
  switch (channel) {
    case 'WHATSAPP': return 'WhatsApp'
    case 'SMS': return 'SMS'
    case 'MESSENGER': return 'Messenger'
    case 'INSTAGRAM': return 'Instagram'
    case 'FACEBOOK_COMMENT': return 'comentario de Facebook'
    case 'INSTAGRAM_COMMENT': return 'comentario de Instagram'
    default: return channel || 'chat'
  }
}

/** Shared error type: a message in Spanish that the person (or the agent) can read as is. */
export class OpsError extends Error {
  /** HTTP status a route should answer with */
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

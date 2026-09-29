import { EventEmitter } from 'events'
import { after } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

declare global {
  // eslint-disable-next-line no-var
  var __inboxEmitter: EventEmitter | undefined
}

// Singleton survives Next.js hot-reloads in dev
const emitter: EventEmitter = globalThis.__inboxEmitter ?? new EventEmitter()
emitter.setMaxListeners(200)
if (process.env.NODE_ENV !== 'production') globalThis.__inboxEmitter = emitter

export type InboxEvent =
  | { type: 'new-message'; conversationId: string; workspaceId: string }
  | { type: 'status-update'; conversationId: string; workspaceId: string }
  | { type: 'ping' }

export function inboxChannelName(workspaceId: string) {
  return `inbox:${workspaceId}`
}

// The in-memory emitter only reaches SSE clients on this same instance; the broadcast reaches every open inbox
async function broadcastInboxEvent(event: Exclude<InboxEvent, { type: 'ping' }>) {
  const admin = getSupabaseAdmin()
  if (!admin) return
  const channel = admin.channel(inboxChannelName(event.workspaceId), { config: { broadcast: { ack: false, self: false } } })
  try {
    await channel.httpSend('inbox', { type: event.type, conversationId: event.conversationId }, { timeout: 5000 })
  } catch {
    // Realtime is best-effort; the inbox polls as fallback
  } finally {
    await admin.removeChannel(channel).catch(() => {})
  }
}

export function emitInboxEvent(event: InboxEvent) {
  emitter.emit('inbox', event)
  if (event.type === 'ping') return
  const task = () => broadcastInboxEvent(event)
  try {
    // Keeps the serverless function alive until the broadcast is sent
    after(task)
  } catch {
    void task().catch(() => {})
  }
}

export function subscribeToInbox(listener: (event: InboxEvent) => void): () => void {
  emitter.on('inbox', listener)
  return () => emitter.off('inbox', listener)
}

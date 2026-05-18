import { EventEmitter } from 'events'

declare global {
  // eslint-disable-next-line no-var
  var __inboxEmitter: EventEmitter | undefined
}

// Singleton survives Next.js hot-reloads in dev
const emitter: EventEmitter = globalThis.__inboxEmitter ?? new EventEmitter()
emitter.setMaxListeners(200)
if (process.env.NODE_ENV !== 'production') globalThis.__inboxEmitter = emitter

export type InboxEvent =
  | { type: 'new-message'; conversationId: string }
  | { type: 'status-update'; conversationId: string }
  | { type: 'ping' }

export function emitInboxEvent(event: InboxEvent) {
  emitter.emit('inbox', event)
}

export function subscribeToInbox(listener: (event: InboxEvent) => void): () => void {
  emitter.on('inbox', listener)
  return () => emitter.off('inbox', listener)
}

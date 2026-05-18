export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { requireAdmin } from '@/lib/admin-utils'
import { subscribeToInbox, type InboxEvent } from '@/lib/messaging/inbox-emitter'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return new Response('Unauthorized', { status: 401 })

  const encoder = new TextEncoder()

  let unsubscribe: (() => void) | null = null
  let keepAlive: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: InboxEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          // connection dropped
        }
      }

      send({ type: 'ping' })

      unsubscribe = subscribeToInbox(send)

      keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          if (keepAlive) clearInterval(keepAlive)
          unsubscribe?.()
        }
      }, 25000)
    },
    cancel() {
      if (keepAlive) clearInterval(keepAlive)
      unsubscribe?.()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

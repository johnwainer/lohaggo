/**
 * Admin review queue of verification documents: pending ones first and oldest first (whoever waits
 * longest is reviewed first), then the already reviewed ones newest first.
 */

type QueueDoc = { status: string; createdAt: Date | string; partnerId?: string; partner?: { id: string } }

const time = (d: Date | string) => new Date(d).getTime()

export function sortReviewQueue<T extends QueueDoc>(docs: T[]): T[] {
  return [...docs].sort((a, b) => {
    const ap = a.status === 'PENDING'
    const bp = b.status === 'PENDING'
    if (ap !== bp) return ap ? -1 : 1
    return ap ? time(a.createdAt) - time(b.createdAt) : time(b.createdAt) - time(a.createdAt)
  })
}

/** Pending documents per partner id, to show "3 pendientes de este socio" in the queue. */
export function pendingCountByPartner(docs: QueueDoc[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const d of docs) {
    const id = d.partnerId ?? d.partner?.id
    if (d.status !== 'PENDING' || !id) continue
    out[id] = (out[id] ?? 0) + 1
  }
  return out
}

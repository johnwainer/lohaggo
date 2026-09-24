export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { indexPending } from '@/lib/ai/knowledge'
import { runReengagement } from '@/lib/ai/autopilot'

const logger = createLogger('cron-ai-maintenance')

/** Knowledge indexing left pending + one-time re-engagement follow-ups. */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && secret !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // A crashed invocation can leave a document "indexing" forever
    await prisma.aiKnowledgeDoc.updateMany({ where: { status: 'indexing', updatedAt: { lt: new Date(Date.now() - 15 * 60_000) } }, data: { status: 'pending' } })
    const indexed = await indexPending(10)
    const reengagement = await runReengagement()
    if (indexed || reengagement.sent) logger.info('AI maintenance', { indexed, ...reengagement })
    return NextResponse.json({ ok: true, indexed, ...reengagement })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error'
    logger.error('AI maintenance error', { message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}

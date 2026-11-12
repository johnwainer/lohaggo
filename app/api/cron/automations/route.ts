import { NextResponse } from 'next/server'
import { cronRoute } from '@/lib/system/cron'
import { createDeadline } from '@/lib/system/deadline'
import { ensureDefaultAutomationRules, processDueAutomations } from '@/lib/messaging/automation-service'
import { createLogger } from '@/lib/logger'
import { checkDocumentReviewSla, runPartnerReactivation } from '@/lib/partners/reactivation'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const logger = createLogger('cron-automations')

/**
 * One shared deadline for every step; whatever is left continues on the next run. The hourly WhatsApp templates
 * and the client welcome run in their own cron (/api/cron/wa-daily) so they cannot starve each other.
 */
async function handle() {
  const deadline = createDeadline()
  try {
    const defaults = await ensureDefaultAutomationRules().catch((err) => {
      logger.error('ensureDefaultAutomationRules failed', { err })
      return null
    })
    const result = await processDueAutomations(200, deadline)
    // Partner reactivation campaign (lib/partners/reactivation.ts): its own window, limits and stop rules
    const reactivation = await runPartnerReactivation(new Date(), deadline).catch((err) => { logger.error('Partner reactivation failed', { err }); return { error: 1 } })
    // Pending verification documents past the review SLA: HIGH incident + in-app notice, closes by itself
    const docsReview = await checkDocumentReviewSla(new Date(), deadline).catch((err) => { logger.error('Document review SLA check failed', { err }); return { error: 1 } })
    logger.info('Cron automations completed', { ...result, reactivation, docsReview })
    return NextResponse.json({ ok: true, ...result, reactivation, docsReview, deadlineHit: deadline.expired(), rulesCreated: defaults?.created ?? 0, rulesLinksFixed: defaults?.fixedLinks ?? 0 })
  } catch (err) {
    logger.error('Cron automations error', { err })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Also allow GET for Vercel cron (it sends GET by default for crons)
export const GET = cronRoute('automations', handle, { maxDuration })
export const POST = GET

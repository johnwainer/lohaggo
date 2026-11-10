import { NextRequest, NextResponse } from 'next/server'
import { cronRoute } from '@/lib/system/cron'
import { ensureDefaultAutomationRules, processDueAutomations } from '@/lib/messaging/automation-service'
import { createLogger } from '@/lib/logger'
import { runWaDaily } from '@/lib/messaging/wa-scheduled'
import { runClientWelcome } from '@/lib/accounts/welcome'
import { checkDocumentReviewSla, runPartnerReactivation } from '@/lib/partners/reactivation'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const logger = createLogger('cron-automations')

async function handle(request: NextRequest) {
  // Verify Vercel cron secret
  const secret = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && secret !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const defaults = await ensureDefaultAutomationRules().catch((err) => {
      logger.error('ensureDefaultAutomationRules failed', { err })
      return null
    })
    const result = await processDueAutomations(200)
    // Hourly WhatsApp templates: partner onboarding (C3, C8, C9), win-back (B23, C30), demand (C29), unfinished chat requests (B24)
    const whatsapp = await runWaDaily().catch((err) => { logger.error('WhatsApp daily templates failed', { err }); return { error: 1 } })
    // Clients who signed up and asked for nothing: welcome at 24 h, reminder at 3 days (app + email)
    const welcome = await runClientWelcome().catch((err) => { logger.error('Client welcome failed', { err }); return { error: 1 } })
    // Partner reactivation campaign (lib/partners/reactivation.ts): its own window, limits and stop rules
    const reactivation = await runPartnerReactivation().catch((err) => { logger.error('Partner reactivation failed', { err }); return { error: 1 } })
    // Pending verification documents past the review SLA: HIGH incident + in-app notice, closes by itself
    const docsReview = await checkDocumentReviewSla().catch((err) => { logger.error('Document review SLA check failed', { err }); return { error: 1 } })
    logger.info('Cron automations completed', { ...result, whatsapp, welcome, reactivation, docsReview })
    return NextResponse.json({ ok: true, ...result, whatsapp, welcome, reactivation, docsReview, rulesCreated: defaults?.created ?? 0, rulesLinksFixed: defaults?.fixedLinks ?? 0 })
  } catch (err) {
    logger.error('Cron automations error', { err })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Also allow GET for Vercel cron (it sends GET by default for crons)
export const GET = cronRoute('automations', handle)
export const POST = GET

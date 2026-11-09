/**
 * Welcome sequence for clients who signed up and asked for nothing (rules in welcome-core.ts): an in-app
 * notification plus an email with the most requested services, at 24 h and once more at 3 days. Runs from
 * the hourly automations cron. No WhatsApp: no approved template says this (B24 is for an unfinished
 * request, B23 for a past service). Respects excludedFromMarketing, email opt-outs and preferences, and
 * the marketing quiet hours (9 p. m. – 8 a. m. Bogotá).
 */
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { createNotification } from '@/lib/notifications/notificationService'
import { sendMessageViaProvider } from '@/lib/messaging/providers'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { isMarketingQuietHour } from '@/lib/messaging/wa-format'
import { isPlaceholderEmail } from '@/lib/accounts/phone-login-core'
import { WELCOME_KEY, welcomeCopy, welcomeScanRange, welcomeStepDue, type PopularService, type WelcomeStep } from '@/lib/accounts/welcome-core'

const logger = createLogger('client-welcome')

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://www.lohaggo.com').replace(/\/+$/, '')
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

async function popularServices(): Promise<PopularService[]> {
  const popular = await prisma.service.findMany({ where: { popular: true }, select: { name: true, slug: true }, orderBy: { name: 'asc' }, take: 4 })
  if (popular.length >= 3) return popular
  const top = await prisma.service.findMany({ select: { name: true, slug: true }, orderBy: { serviceRequests: { _count: 'desc' } }, take: 4 })
  return top
}

function stepOf(data: string | null) {
  const m = data?.match(new RegExp(`"welcome":"${WELCOME_KEY}_(\\d)"`))
  return m ? Number(m[1]) : null
}

async function emailAllowed(user: { id: string; email: string; notificationsEmailEnabled: boolean }, step: WelcomeStep) {
  if (!user.email || isPlaceholderEmail(user.email) || !user.notificationsEmailEnabled) return false
  const optOut = await prisma.messagingOptOut.findFirst({ where: { channel: 'EMAIL', isActive: true, OR: [{ userId: user.id }, { destination: user.email }] }, select: { id: true } })
  if (optOut) return false
  // The 3-day «Primer servicio» automation already emailed them: the reminder stays in the app only
  if (step === 2) {
    const nudge = await prisma.automationExecution.findFirst({ where: { userId: user.id, channel: 'EMAIL', status: 'SENT', rule: { trigger: 'CLIENT_FIRST_BOOKING_NUDGE' } }, select: { id: true } })
    if (nudge) return false
  }
  return true
}

function emailBody(firstName: string, copy: ReturnType<typeof welcomeCopy>, services: PopularService[], step: WelcomeStep) {
  const base = appUrl()
  const utm = `utm_source=email&utm_medium=lifecycle&utm_campaign=${WELCOME_KEY}_${step}`
  const links = services.map((s) => `• <a href="${base}/servicios/${encodeURIComponent(s.slug)}?${utm}">${escapeHtml(s.name)}</a>`).join('<br>')
  return [
    `Hola ${escapeHtml(firstName)},`,
    '',
    escapeHtml(copy.message.replace(/ Lo más pedido: .*$/, '')),
    '',
    links ? `<strong>Lo más pedido:</strong><br>${links}` : '',
    '',
    `<a href="${base}/?${utm}">Pedir un servicio</a>`,
    '',
    'Si prefieres, escríbenos por WhatsApp desde lohaggo.com y lo pedimos contigo.',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('<br>')
}

export async function runClientWelcome(now: Date = new Date(), limit = 100) {
  if (isMarketingQuietHour(now)) return { skipped: 'quiet_hours' as const, sent: 0, emails: 0 }
  const users = await prisma.user.findMany({
    where: {
      role: 'CLIENT', isActive: true, excludedFromMarketing: false, createdAt: welcomeScanRange(now),
      serviceRequests: { none: {} }, bookings: { none: {} },
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, excludedFromMarketing: true, createdAt: true, notificationsEmailEnabled: true },
    orderBy: { createdAt: 'asc' },
    take: 300,
  })
  if (!users.length) return { sent: 0, emails: 0 }

  const prior = await prisma.notification.findMany({
    where: { userId: { in: users.map((u) => u.id) }, data: { contains: `"welcome":"${WELCOME_KEY}_` } },
    select: { userId: true, data: true, createdAt: true },
  })
  const sentBy = new Map<string, Array<{ step: number; at: Date }>>()
  for (const n of prior) {
    const step = stepOf(n.data)
    if (step) sentBy.set(n.userId, [...(sentBy.get(n.userId) ?? []), { step, at: n.createdAt }])
  }

  let services: PopularService[] | null = null
  let runtime: Awaited<ReturnType<typeof getMessagingProviderRuntimeConfig>> | null = null
  let sent = 0
  let emails = 0
  for (const u of users) {
    if (sent >= limit) break
    const step = welcomeStepDue({ createdAt: u.createdAt, now, sent: sentBy.get(u.id) ?? [], hasActivity: false, excludedFromMarketing: u.excludedFromMarketing, isActive: u.isActive, role: u.role })
    if (!step) continue
    services ??= await popularServices()
    const firstName = (u.name || '').trim().split(/\s+/)[0] || 'Hola'
    const copy = welcomeCopy(step, firstName, services)
    try {
      // In the app (no automatic channels: the email below has its own words and links)
      await createNotification({ userId: u.id, type: 'NEW_SERVICE_REQUEST', title: copy.title, message: copy.message, data: { url: '/', welcome: `${WELCOME_KEY}_${step}` }, channels: [] })
      sent++
      if (await emailAllowed(u, step)) {
        runtime ??= await getMessagingProviderRuntimeConfig()
        if (runtime.sendgrid?.active) {
          const res = await sendMessageViaProvider({ channel: 'EMAIL', to: u.email, subject: copy.subject, body: emailBody(firstName, copy, services, step) }, runtime)
          if (res.ok) emails++
        }
      }
    } catch (err) {
      logger.warn('Client welcome failed', { userId: u.id, step, err: err instanceof Error ? err.message : err })
    }
  }
  if (sent) logger.info('Client welcome sent', { sent, emails })
  return { sent, emails }
}

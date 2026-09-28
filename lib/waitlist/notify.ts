/**
 * Tells a city's waitlist that it opened: WhatsApp (B25) to the entries that gave a number with its consent,
 * email to the rest. Each entry is stamped notifiedAt once, so running it again only reaches new sign-ups.
 */
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { sendMessageViaProvider } from '@/lib/messaging/providers'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { deliverWa } from '@/lib/messaging/wa-send'
import { WA } from '@/lib/messaging/wa-specs'

const logger = createLogger('waitlist-notify')
const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://www.lohaggo.com').replace(/\/+$/, '')
const escapeHtml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export async function notifyWaitlistOpened(citySlug: string, opts: { limit?: number } = {}) {
  const city = await prisma.cityConfig.findUnique({ where: { slug: citySlug }, select: { name: true, status: true } })
  if (!city) throw new Error('Ciudad no encontrada')
  if (city.status !== 'ACTIVE') throw new Error(`${city.name} todavía no está activa: el aviso diría algo falso`)
  const entries = await prisma.cityWaitlist.findMany({ where: { citySlug, notifiedAt: null }, orderBy: { createdAt: 'asc' }, take: opts.limit ?? 500 })
  const runtime = await getMessagingProviderRuntimeConfig()
  let whatsapp = 0
  let email = 0
  let failed = 0
  for (const e of entries) {
    let sent = false
    if (e.phone && e.phoneConsentAt) {
      const r = await deliverWa({ userId: null, phone: e.phone, name: e.name }, WA.B25({ entryId: e.id, name: e.name, city: city.name })).catch(() => null)
      if (r?.ok) { sent = true; whatsapp++ }
    }
    if (!sent && runtime.sendgrid?.active) {
      const first = escapeHtml((e.name || '').split(' ')[0] || '')
      const body = [
        `Hola${first ? ` ${first}` : ''},`,
        '',
        `LoHaggo ya está disponible en ${escapeHtml(city.name)}. Te avisamos como pediste: ya puedes pedir servicios para tu hogar con profesionales verificados.`,
        '',
        `<a href="${appUrl()}/?utm_source=waitlist&utm_medium=email&utm_campaign=apertura-${citySlug}">Entrar a LoHaggo</a>`,
        '',
        'Recibiste este correo porque te inscribiste en la lista de espera. No te enviaremos más avisos de esta lista.',
      ].join('<br>')
      const r = await sendMessageViaProvider({ channel: 'EMAIL', to: e.email, subject: `LoHaggo ya llegó a ${city.name}`, body }, runtime).catch(() => ({ ok: false }))
      if (r.ok) { sent = true; email++ }
    }
    if (sent) await prisma.cityWaitlist.update({ where: { id: e.id }, data: { notifiedAt: new Date() } })
    else failed++
  }
  logger.info('Waitlist notified', { citySlug, whatsapp, email, failed })
  return { total: entries.length, whatsapp, email, failed }
}

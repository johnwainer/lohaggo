/**
 * Daily ad spend typed in by hand from Meta Ads Manager (until ads_read): one row per package, day and ad set.
 * The attribution board divides it by the requests and bookings each package brought.
 */
import { prisma } from '@/lib/prisma'

export class AdSpendError extends Error {}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Bogotá's today as YYYY-MM-DD (the day Ads Manager reports in). */
export const bogotaDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d)

export type AdSpendInput = { day: string; amountCop: number; adSet?: string | null; note?: string | null }

export function parseAdSpendInput(b: Record<string, unknown>): AdSpendInput {
  const day = typeof b.day === 'string' ? b.day.trim() : ''
  if (!DAY_RE.test(day) || Number.isNaN(Date.parse(`${day}T12:00:00Z`))) throw new AdSpendError('Fecha inválida')
  if (day > bogotaDay()) throw new AdSpendError('No se puede cargar gasto de un día que no ha pasado')
  const amount = Math.round(Number(b.amountCop))
  if (!Number.isFinite(amount) || amount < 0 || amount > 50_000_000) throw new AdSpendError('El gasto debe ser un valor en pesos entre 0 y 50.000.000')
  const adSet = typeof b.adSet === 'string' ? b.adSet.trim().slice(0, 80) : ''
  const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim().slice(0, 300) : null
  return { day, amountCop: amount, adSet, note }
}

/** Upsert: typing the same day and ad set again replaces the amount. */
export async function recordAdSpend(p: { workspaceId: string; adDraftId: string; campaignId: string | null; input: AdSpendInput; userId: string }) {
  const day = new Date(`${p.input.day}T00:00:00Z`)
  const adSet = p.input.adSet ?? ''
  return prisma.marketingAdSpend.upsert({
    where: { workspaceId_day_key_adSet: { workspaceId: p.workspaceId, day, key: p.adDraftId, adSet } },
    create: { workspaceId: p.workspaceId, day, key: p.adDraftId, adDraftId: p.adDraftId, campaignId: p.campaignId, adSet, amountCop: p.input.amountCop, note: p.input.note, createdById: p.userId },
    update: { amountCop: p.input.amountCop, note: p.input.note, createdById: p.userId },
  })
}

export async function listAdSpend(adDraftId: string) {
  const rows = await prisma.marketingAdSpend.findMany({ where: { adDraftId }, orderBy: [{ day: 'desc' }, { adSet: 'asc' }], take: 120 })
  return rows.map((r) => ({ id: r.id, day: r.day.toISOString().slice(0, 10), adSet: r.adSet, amountCop: r.amountCop, note: r.note }))
}

/** Spend per package in a period (days inclusive), for the board and Haggo. */
export async function spendByDraft(from: Date, to: Date) {
  const rows = await prisma.marketingAdSpend.groupBy({ by: ['key'], where: { day: { gte: from, lte: to } }, _sum: { amountCop: true } }).catch(() => [])
  return new Map(rows.map((r) => [r.key, r._sum.amountCop ?? 0]))
}

/** Spend per package and day, for the «spend without requests» rule. */
export async function spendDays(since: Date) {
  return prisma.marketingAdSpend.findMany({ where: { day: { gte: since }, amountCop: { gt: 0 } }, select: { key: true, day: true, amountCop: true } }).catch(() => [])
}

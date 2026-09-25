import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { bogotaDayStart } from '@/lib/admin/overview-core'
import { periodOf } from '@/lib/ai/pricing'
import { DEFAULT_CONFIG, normalizeConfig, type HaggoConfig } from '@/lib/haggo/config'

const ID = 'platform'
export const HAGGO_KINDS = ['haggo_cycle', 'haggo_chat', 'haggo_report'] as const

/** Reads the row; creates it (with the base configuration) only the first time. */
export async function getHaggoRow() {
  return (await prisma.haggoSettings.findUnique({ where: { id: ID } })) ?? prisma.haggoSettings.upsert({ where: { id: ID }, create: { id: ID }, update: {} })
}

export async function getHaggoConfig(pre?: Awaited<ReturnType<typeof getHaggoRow>>): Promise<HaggoConfig> {
  const row = pre ?? (await getHaggoRow())
  return normalizeConfig(row as unknown as Record<string, unknown>, DEFAULT_CONFIG)
}

const json = (v: unknown) => (v == null ? Prisma.DbNull : (v as Prisma.InputJsonValue))

/** Merges a partial change over the current config; only valid values stick. */
export async function saveHaggoConfig(patch: Record<string, unknown>, email: string | null) {
  const next = normalizeConfig(patch, await getHaggoConfig())
  const data = {
    enabled: next.enabled, mode: next.mode, domainModes: json(next.domainModes), mediumAllowed: json(next.mediumAllowed), maxRiskEnabled: json(next.maxRiskEnabled),
    monthlyBudgetUsd: next.monthlyBudgetUsd, dailyBudgetUsd: next.dailyBudgetUsd, maxActionsPerCycle: next.maxActionsPerCycle, maxActionsPerDay: next.maxActionsPerDay,
    humanCooldownHours: next.humanCooldownHours, repeatCooldownHours: next.repeatCooldownHours, cycleMinutes: next.cycleMinutes,
    dailyReportHour: next.dailyReportHour, weeklyReviewDay: next.weeklyReviewDay, weeklyReviewHour: next.weeklyReviewHour, proposalTtlHours: next.proposalTtlHours,
    triggers: json(next.triggers), quietHours: json(next.quietHours), timezone: next.timezone, model: next.model, updatedByEmail: email,
  }
  await prisma.haggoSettings.upsert({ where: { id: ID }, create: { id: ID, ...data }, update: data })
  return next
}

/** What Haggo spent on AI today (Bogotá) and this month, against its own budget. */
export async function haggoSpend(cfg: Pick<HaggoConfig, 'monthlyBudgetUsd' | 'dailyBudgetUsd'>, now = new Date()) {
  const kinds = { in: [...HAGGO_KINDS] }
  const [month, today] = await Promise.all([
    prisma.aiCall.aggregate({ where: { kind: kinds, period: periodOf(now) }, _sum: { costUsd: true }, _count: { _all: true } }),
    prisma.aiCall.aggregate({ where: { kind: kinds, createdAt: { gte: bogotaDayStart(now) } }, _sum: { costUsd: true } }),
  ])
  const monthUsd = month._sum.costUsd ?? 0
  const todayUsd = today._sum.costUsd ?? 0
  const blocked = monthUsd >= cfg.monthlyBudgetUsd ? 'month' : todayUsd >= cfg.dailyBudgetUsd ? 'day' : null
  return { monthUsd, todayUsd, calls: month._count._all, blocked: blocked as 'month' | 'day' | null }
}

/** One Haggo job at a time across servers; the lock expires alone if a run dies. */
export async function withHaggoLock<T>(fn: () => Promise<T>, minutes = 12): Promise<T | null> {
  const now = new Date()
  const got = await prisma.haggoSettings.updateMany({ where: { id: ID, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] }, data: { lockedUntil: new Date(now.getTime() + minutes * 60_000) } })
  if (!got.count) return null
  try {
    return await fn()
  } finally {
    await prisma.haggoSettings.update({ where: { id: ID }, data: { lockedUntil: null } }).catch(() => null)
  }
}

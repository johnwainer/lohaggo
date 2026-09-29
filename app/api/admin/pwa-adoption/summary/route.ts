import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'

function dayKey(value: Date) {
  return value.toISOString().slice(0, 10)
}

type VariantStats = {
  signups: number
  installs: number
  pushOptIns: number
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const from30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const DAY = 24 * 60 * 60 * 1000
  const EVENTS = ['pwa_installed', 'push_subscription_created']
  type Row = Record<string, unknown>
  const num = (v: unknown) => Number(v ?? 0)

  // Everything is aggregated in Postgres: only counts per day/role/variant come back, never raw events
  const [signupRows, eventRows, distinctRows, [cohort = {}], variantRows, outreachCandidates] = await Promise.all([
    prisma.$queryRaw<Row[]>`
      SELECT u.role::text AS role, to_char(u."createdAt", 'YYYY-MM-DD') AS d, count(*)::int AS n
      FROM "User" u WHERE u."createdAt" >= ${from30d} AND u.role::text IN ('CLIENT', 'PARTNER')
      GROUP BY 1, 2`,
    prisma.$queryRaw<Row[]>`
      SELECT e."eventName" AS event, e.role::text AS role, to_char(e."createdAt", 'YYYY-MM-DD') AS d, count(*)::int AS n
      FROM "PwaTelemetryEvent" e JOIN "User" u ON u.id = e."userId"
      WHERE e."createdAt" >= ${from30d} AND e."eventName" IN (${EVENTS[0]}, ${EVENTS[1]})
        AND u."createdAt" >= ${from30d} AND u.role::text IN ('CLIENT', 'PARTNER')
      GROUP BY 1, 2, 3`,
    prisma.$queryRaw<Row[]>`
      SELECT e."eventName" AS event, count(DISTINCT e."userId")::int AS users
      FROM "PwaTelemetryEvent" e JOIN "User" u ON u.id = e."userId"
      WHERE e."createdAt" >= ${from30d} AND e."eventName" IN (${EVENTS[0]}, ${EVENTS[1]})
        AND u."createdAt" >= ${from30d} AND u.role::text IN ('CLIENT', 'PARTNER')
      GROUP BY 1`,
    prisma.$queryRaw<Row[]>`
      SELECT
        count(*) FILTER (WHERE u."createdAt" >= ${new Date(now.getTime() - DAY)})::int AS signups_d0,
        count(*) FILTER (WHERE u."createdAt" >= ${new Date(now.getTime() - DAY)} AND p."installedAt" IS NOT NULL AND p."installedAt" - u."createdAt" <= interval '24 hours')::int AS installed_d0,
        count(*) FILTER (WHERE u."createdAt" <= ${new Date(now.getTime() - 7 * DAY)})::int AS signups_d7,
        count(*) FILTER (WHERE u."createdAt" <= ${new Date(now.getTime() - 7 * DAY)} AND p."installedAt" IS NOT NULL AND p."installedAt" - u."createdAt" <= interval '7 days')::int AS installed_d7
      FROM "User" u JOIN "PwaAdoptionProfile" p ON p."userId" = u.id
      WHERE u."createdAt" >= ${from30d} AND u.role::text IN ('CLIENT', 'PARTNER')`,
    prisma.$queryRaw<Row[]>`
      SELECT CASE WHEN p."abVariant" = 'B' THEN 'B' ELSE 'A' END AS variant, count(*)::int AS signups,
             count(p."installedAt")::int AS installs, count(p."pushEnabledAt")::int AS push
      FROM "User" u JOIN "PwaAdoptionProfile" p ON p."userId" = u.id
      WHERE u."createdAt" >= ${from30d} AND u.role::text IN ('CLIENT', 'PARTNER')
      GROUP BY 1`,
    prisma.user.findMany({
      where: {
        role: { in: ['CLIENT', 'PARTNER'] },
        createdAt: { lte: new Date(now.getTime() - 3 * DAY) },
        pwaAdoptionProfile: {
          installedAt: null,
          promptAttemptsWindow: { gte: 2 },
        },
      },
      select: { role: true },
      take: 500,
    }),
  ])

  const installsByRole = { CLIENT: 0, PARTNER: 0 }
  const pushByRole = { CLIENT: 0, PARTNER: 0 }

  const dailyMap = new Map<string, { date: string; signups: number; installs: number; pushOptIns: number }>()
  for (let i = 0; i < 30; i += 1) {
    const date = new Date(now.getTime() - (29 - i) * DAY)
    const key = dayKey(date)
    dailyMap.set(key, { date: key, signups: 0, installs: 0, pushOptIns: 0 })
  }

  let totalSignups = 0
  let clientSignups = 0
  let partnerSignups = 0
  for (const row of signupRows) {
    const count = num(row.n)
    totalSignups += count
    if (row.role === 'CLIENT') clientSignups += count
    if (row.role === 'PARTNER') partnerSignups += count
    const bucket = dailyMap.get(String(row.d))
    if (bucket) bucket.signups += count
  }

  for (const row of eventRows) {
    const count = num(row.n)
    const bucket = dailyMap.get(String(row.d))
    const installed = row.event === 'pwa_installed'
    const byRole = installed ? installsByRole : pushByRole
    if (row.role === 'CLIENT' || row.role === 'PARTNER') byRole[row.role] += count
    if (bucket) {
      if (installed) bucket.installs += count
      else bucket.pushOptIns += count
    }
  }

  const distinctUsers = (event: string) => num(distinctRows.find((row) => row.event === event)?.users)
  const installedUsers = distinctUsers('pwa_installed')
  const pushOptInUsers = distinctUsers('push_subscription_created')

  const installRate = totalSignups === 0 ? 0 : Number(((installedUsers / totalSignups) * 100).toFixed(2))
  const pushOptInRate = totalSignups === 0 ? 0 : Number(((pushOptInUsers / totalSignups) * 100).toFixed(2))

  const signupsD0 = num(cohort.signups_d0)
  const installedD0 = num(cohort.installed_d0)
  const signupsD7Eligible = num(cohort.signups_d7)
  const installedD7 = num(cohort.installed_d7)

  const variantStats: Record<string, VariantStats> = {
    A: { signups: 0, installs: 0, pushOptIns: 0 },
    B: { signups: 0, installs: 0, pushOptIns: 0 },
  }
  for (const row of variantRows) {
    const variant = row.variant === 'B' ? 'B' : 'A'
    variantStats[variant].signups += num(row.signups)
    variantStats[variant].installs += num(row.installs)
    variantStats[variant].pushOptIns += num(row.push)
  }

  return NextResponse.json({
    generatedAt: now.toISOString(),
    rangeDays: 30,
    summary: {
      signups: totalSignups,
      installedUsers,
      pushOptInUsers,
      installRate,
      pushOptInRate,
      installRateD0: signupsD0 === 0 ? 0 : Number(((installedD0 / signupsD0) * 100).toFixed(2)),
      installRateD7: signupsD7Eligible === 0 ? 0 : Number(((installedD7 / signupsD7Eligible) * 100).toFixed(2)),
      signupsD0,
      signupsD7Eligible,
      outreachCandidates: outreachCandidates.length,
      outreachCandidatesClient: outreachCandidates.filter((item) => item.role === 'CLIENT').length,
      outreachCandidatesPartner: outreachCandidates.filter((item) => item.role === 'PARTNER').length,
    },
    byRole: {
      CLIENT: {
        signups: clientSignups,
        installs: installsByRole.CLIENT,
        pushOptIns: pushByRole.CLIENT,
      },
      PARTNER: {
        signups: partnerSignups,
        installs: installsByRole.PARTNER,
        pushOptIns: pushByRole.PARTNER,
      },
    },
    byVariant: {
      A: {
        ...variantStats.A,
        installRate: variantStats.A.signups === 0 ? 0 : Number(((variantStats.A.installs / variantStats.A.signups) * 100).toFixed(2)),
        pushOptInRate: variantStats.A.signups === 0 ? 0 : Number(((variantStats.A.pushOptIns / variantStats.A.signups) * 100).toFixed(2)),
      },
      B: {
        ...variantStats.B,
        installRate: variantStats.B.signups === 0 ? 0 : Number(((variantStats.B.installs / variantStats.B.signups) * 100).toFixed(2)),
        pushOptInRate: variantStats.B.signups === 0 ? 0 : Number(((variantStats.B.pushOptIns / variantStats.B.signups) * 100).toFixed(2)),
      },
    },
    daily: Array.from(dailyMap.values()),
  })
}

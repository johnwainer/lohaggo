import { notifyWaitlistOpened } from '@/lib/waitlist/notify'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { WAITLIST_ROLES } from '@/lib/waitlist/schema'

const logger = createLogger('admin-waitlist')

const PAGE_SIZE = 50

function csvCell(value: string | null | undefined): string {
  let v = value ?? ''
  // Avoid spreadsheet formula injection
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`
  return `"${v.replace(/"/g, '""')}"`
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = request.nextUrl.searchParams
  const citySlug = sp.get('city') || undefined
  const roleParam = sp.get('role')
  const role = roleParam && (WAITLIST_ROLES as readonly string[]).includes(roleParam) ? roleParam : undefined
  const where = { ...(citySlug ? { citySlug } : {}), ...(role ? { role } : {}) }

  try {
    if (sp.get('format') === 'csv') {
      const rows = await prisma.cityWaitlist.findMany({ where, orderBy: [{ citySlug: 'asc' }, { createdAt: 'asc' }] })
      const header = ['ciudad', 'correo', 'nombre', 'rol', 'consentimiento', 'registrado', 'avisado']
      const lines = rows.map((r) =>
        [
          r.citySlug,
          r.email,
          r.name,
          r.role === 'partner' ? 'socio' : 'cliente',
          r.consentAt.toISOString(),
          r.createdAt.toISOString(),
          r.notifiedAt ? r.notifiedAt.toISOString() : '',
        ]
          .map(csvCell)
          .join(',')
      )
      await auditAdminAction({
        actorId: admin.id,
        actorEmail: admin.email,
        action: 'WAITLIST_EXPORT',
        entityType: 'CityWaitlist',
        entityId: citySlug ?? null,
        route: '/api/admin/waitlist',
        details: JSON.stringify({ citySlug: citySlug ?? null, role: role ?? null, rows: rows.length }),
        request,
      })
      const name = `lista-espera${citySlug ? `-${citySlug}` : ''}-${new Date().toISOString().slice(0, 10)}.csv`
      return new NextResponse('﻿' + [header.join(','), ...lines].join('\r\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${name}"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
    const [groups, cities, total, entries] = await Promise.all([
      prisma.cityWaitlist.groupBy({
        by: ['citySlug', 'role'],
        _count: { _all: true },
      }),
      prisma.cityConfig.findMany({ select: { slug: true, name: true, status: true }, orderBy: { order: 'asc' } }),
      prisma.cityWaitlist.count({ where }),
      prisma.cityWaitlist.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ])
    const pending = await prisma.cityWaitlist.groupBy({
      by: ['citySlug'],
      where: { notifiedAt: null },
      _count: { _all: true },
    })

    const bySlug = new Map<string, { citySlug: string; client: number; partner: number; pending: number }>()
    for (const g of groups) {
      const row = bySlug.get(g.citySlug) ?? { citySlug: g.citySlug, client: 0, partner: 0, pending: 0 }
      if (g.role === 'partner') row.partner += g._count._all
      else row.client += g._count._all
      bySlug.set(g.citySlug, row)
    }
    for (const p of pending) {
      const row = bySlug.get(p.citySlug)
      if (row) row.pending = p._count._all
    }
    const cityName = new Map(cities.map((c) => [c.slug, c.name]))
    const summary = Array.from(bySlug.values())
      .map((r) => ({ ...r, cityName: cityName.get(r.citySlug) ?? r.citySlug }))
      .sort((a, b) => b.client + b.partner - (a.client + a.partner))

    return NextResponse.json({
      summary,
      cities,
      entries,
      total,
      page,
      pageSize: PAGE_SIZE,
    })
  } catch (error) {
    logger.error('Error fetching waitlist', error || undefined)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const notifySchema = z.object({ citySlug: z.string().trim().min(1).max(100) })

/** Marks the city's pending sign-ups as notified. It does not send any message. */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
  const parsed = notifySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Ciudad requerida' }, { status: 400 })

  const { citySlug } = parsed.data
  try {
    const sent = await notifyWaitlistOpened(citySlug).catch((err: Error) => ({ error: err.message }))
    if ('error' in sent) return NextResponse.json({ error: sent.error }, { status: 400 })
    const result = { count: sent.whatsapp + sent.email, ...sent }
    await auditAdminAction({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'WAITLIST_NOTIFIED',
      entityType: 'CityWaitlist',
      entityId: citySlug,
      route: '/api/admin/waitlist',
      details: JSON.stringify({ citySlug, ...result }),
      request,
    })
    return NextResponse.json({ ok: true, updated: result.count, whatsapp: result.whatsapp, email: result.email, failed: result.failed })
  } catch (error) {
    logger.error('Error marking waitlist as notified', error || undefined)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

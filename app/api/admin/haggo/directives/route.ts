import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditAdminAction } from '@/lib/admin-utils'
import { requireHaggoAdmin } from '@/lib/haggo/auth'
import { cleanDirectiveText, describeRule, parseRule, type DirectiveRule } from '@/lib/haggo/directives'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireHaggoAdmin()
  if (!auth.ok) return auth.response
  const rows = await prisma.haggoDirective.findMany({ orderBy: [{ active: 'desc' }, { createdAt: 'asc' }] })
  return NextResponse.json({ directives: rows.map((d) => ({ ...d, ruleText: describeRule(d.rule as DirectiveRule | null) })) })
}

export async function POST(request: NextRequest) {
  const auth = await requireHaggoAdmin()
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => ({}))
  const text = cleanDirectiveText(body.text)
  if (!text) return NextResponse.json({ error: 'Escribe la directiva' }, { status: 400 })
  const parsed = parseRule(body.rule)
  if (!parsed.ok) return NextResponse.json({ error: parsed.errors.join(' · ') }, { status: 400 })
  const d = await prisma.haggoDirective.create({ data: { text, rule: parsed.rule ? (parsed.rule as Prisma.InputJsonValue) : Prisma.DbNull, active: body.active !== false, createdById: auth.admin.id, createdByEmail: auth.admin.email } })
  await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'HAGGO_DIRECTIVE_CREATE', entityType: 'HaggoDirective', entityId: d.id, details: JSON.stringify({ text, rule: parsed.rule }), request })
  return NextResponse.json({ ok: true, directive: d })
}

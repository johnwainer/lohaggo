import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditAdminAction } from '@/lib/admin-utils'
import { requireHaggoAdmin } from '@/lib/haggo/auth'
import { cleanDirectiveText, parseRule } from '@/lib/haggo/directives'

type Ctx = { params: Promise<{ id: string }> }

/** Edit text or rule, or turn a directive on and off. */
export async function PATCH(request: NextRequest, context: Ctx) {
  const auth = await requireHaggoAdmin()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  const data: Prisma.HaggoDirectiveUpdateInput = {}
  if (body.text !== undefined) {
    const text = cleanDirectiveText(body.text)
    if (!text) return NextResponse.json({ error: 'La directiva no puede quedar vacía' }, { status: 400 })
    data.text = text
  }
  if (body.rule !== undefined) {
    const parsed = parseRule(body.rule)
    if (!parsed.ok) return NextResponse.json({ error: parsed.errors.join(' · ') }, { status: 400 })
    data.rule = parsed.rule ? (parsed.rule as Prisma.InputJsonValue) : Prisma.DbNull
  }
  if (typeof body.active === 'boolean') data.active = body.active
  const res = await prisma.haggoDirective.updateMany({ where: { id }, data: data as Prisma.HaggoDirectiveUpdateManyMutationInput })
  if (!res.count) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'HAGGO_DIRECTIVE_UPDATE', entityType: 'HaggoDirective', entityId: id, details: JSON.stringify(body).slice(0, 1000), request })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const auth = await requireHaggoAdmin()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const d = await prisma.haggoDirective.findUnique({ where: { id } })
  if (!d) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  await prisma.haggoDirective.delete({ where: { id } })
  await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'HAGGO_DIRECTIVE_DELETE', entityType: 'HaggoDirective', entityId: id, details: JSON.stringify({ text: d.text }), request })
  return NextResponse.json({ ok: true })
}

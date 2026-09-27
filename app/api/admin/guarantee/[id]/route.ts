import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { getGuaranteeClaim, resolveGuaranteeClaim } from '@/lib/guarantee/ops'
import { GUARANTEE_REMEDIES, type GuaranteeRemedy } from '@/lib/guarantee/policy'
import { opsErrorResponse } from '@/lib/ops/actor'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  try {
    return NextResponse.json(await getGuaranteeClaim(id))
  } catch (err) {
    return opsErrorResponse(err)
  }
}

const resolveSchema = z.object({
  remedy: z.enum(GUARANTEE_REMEDIES as [GuaranteeRemedy, ...GuaranteeRemedy[]]),
  note: z.string().trim().min(5, 'Escribe una nota con lo que se decidió').max(2000),
  partnerStrike: z.boolean().default(false),
})

/** Resolve: { remedy, note, partnerStrike } */
export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  const parsed = resolveSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  try {
    const result = await resolveGuaranteeClaim({ userId: admin.id, role: 'ADMIN', email: admin.email }, id, parsed.data)
    await auditAdminAction({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'GUARANTEE_RESOLVE',
      entityType: 'GuaranteeClaim',
      entityId: id,
      route: `/api/admin/guarantee/${id}`,
      details: JSON.stringify({ remedy: parsed.data.remedy, partnerStrike: result.claim.partnerStrike, from: result.previous.status, to: result.claim.status, consequence: result.consequence }),
      request,
    })
    return NextResponse.json(result)
  } catch (err) {
    return opsErrorResponse(err)
  }
}

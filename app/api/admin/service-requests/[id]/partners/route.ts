import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { opsErrorResponse } from '@/lib/ops/actor'
import { requestPartnerCandidates } from '@/lib/admin/request-partners'

export const dynamic = 'force-dynamic'

/** Partners who could be told about this request again, with who can see it and how many times they were told. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    return NextResponse.json(await requestPartnerCandidates((await context.params).id))
  } catch (err) {
    return opsErrorResponse(err)
  }
}

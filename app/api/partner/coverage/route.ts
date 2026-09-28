import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPartnerCoverage, setPartnerSchedule, setPartnerZones } from '@/lib/partners/coverage'
import { parseSchedule } from '@/lib/partners/coverage-core'
import { isZoneKey } from '@/lib/geo/zones'
import { APP_ORIGIN, OpsError, type Actor } from '@/lib/ops/origin'

async function partnerActor(): Promise<Actor | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  const partner = await prisma.partnerProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } })
  if (!partner) return null
  return { userId: session.user.id, role: 'PARTNER', partnerId: partner.id, email: session.user.email ?? null }
}

function fail(error: unknown, fallback: string) {
  if (error instanceof OpsError) return NextResponse.json({ error: error.message }, { status: error.status })
  return NextResponse.json({ error: fallback }, { status: 500 })
}

export async function GET() {
  const actor = await partnerActor()
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    return NextResponse.json(await getPartnerCoverage(actor.partnerId!))
  } catch (error) {
    return fail(error, 'Error al cargar zonas y horario')
  }
}

export async function PUT(req: NextRequest) {
  const actor = await partnerActor()
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body || (body.zones === undefined && body.schedule === undefined)) {
    return NextResponse.json({ error: 'Envía zones o schedule' }, { status: 400 })
  }
  // Validate both first so a bad half does not leave the other half saved
  if (body.schedule !== undefined) {
    const parsed = parseSchedule(body.schedule)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  if (body.zones !== undefined && (!Array.isArray(body.zones) || !body.zones.every(isZoneKey))) {
    return NextResponse.json({ error: 'Zonas inválidas' }, { status: 400 })
  }
  try {
    if (body.zones !== undefined) await setPartnerZones(actor, body.zones, APP_ORIGIN)
    if (body.schedule !== undefined) await setPartnerSchedule(actor, body.schedule, APP_ORIGIN)
    return NextResponse.json(await getPartnerCoverage(actor.partnerId!))
  } catch (error) {
    return fail(error, 'Error al guardar zonas y horario')
  }
}

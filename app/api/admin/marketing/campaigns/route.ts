import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { marketingAuth, mkCan } from '@/lib/marketing/permissions'
import { sanitizeCampaignInput } from '@/lib/marketing/input'

export async function POST(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => ({}))
  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
  if (!workspaceId || !mkCan(auth.access, workspaceId, 'marketing.edit')) return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 })
  try {
    const data = sanitizeCampaignInput(body)
    if (!data.name) return NextResponse.json({ error: 'La campaña necesita un nombre' }, { status: 400 })
    const campaign = await prisma.marketingCampaign.create({ data: { ...(data as { name: string }), workspaceId, createdById: auth.admin.id } })
    return NextResponse.json({ campaign })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Datos inválidos' }, { status: 400 })
  }
}

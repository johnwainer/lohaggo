import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import type { IconTheme } from '@/lib/icon-themes'

const FLAG_KEY = 'icon_theme'
const VALID_THEMES: IconTheme[] = ['emoji', 'moderno', 'minimal', 'vivo']

export async function GET() {
  const flag = await prisma.featureFlag.findUnique({ where: { key: FLAG_KEY } })
  const theme: IconTheme = (flag?.metadata as IconTheme | null) ?? 'emoji'
  return NextResponse.json({ theme }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const theme: IconTheme = body?.theme

  if (!VALID_THEMES.includes(theme)) {
    return NextResponse.json({ error: 'Tema inválido' }, { status: 400 })
  }

  await prisma.featureFlag.upsert({
    where: { key: FLAG_KEY },
    create: {
      key: FLAG_KEY,
      name: 'Tema de íconos de servicios',
      description: 'Controla el estilo visual de los íconos en los servicios',
      enabled: true,
      rolloutPercentage: 100,
      metadata: theme,
    },
    update: { metadata: theme },
  })

  return NextResponse.json({ theme })
}

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TERMS_VERSION } from '@/lib/privacy/consent'

export const dynamic = 'force-dynamic'

/** Does the signed-in person still have to accept the terms (accounts born in a chat have no record)? */
export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ needed: false })
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { termsAcceptedAt: true, role: true } })
  return NextResponse.json({ needed: Boolean(u && u.role !== 'ADMIN' && !u.termsAcceptedAt) })
}

/** { marketing?: boolean } → records the acceptance (and the optional marketing consent). */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { marketing?: unknown }
  const now = new Date()
  await prisma.user.updateMany({
    where: { id: userId, termsAcceptedAt: null },
    data: { termsAcceptedAt: now, termsVersion: TERMS_VERSION },
  })
  if (body.marketing === true) await prisma.user.updateMany({ where: { id: userId, marketingConsentAt: null }, data: { marketingConsentAt: now } })
  return NextResponse.json({ ok: true })
}

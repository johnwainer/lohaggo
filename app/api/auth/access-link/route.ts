import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { phoneE164 } from '@/lib/accounts/phone-login'
import { sendAccessLink } from '@/lib/accounts/access-link'
import { clientIp, overLimit } from '@/lib/rate-limit-store'

export const dynamic = 'force-dynamic'

/**
 * { phone } → if an account has that phone, its access link goes to that account's own WhatsApp (or email
 * when the phone was never confirmed). The answer is always the same, so it tells nothing about who has an account.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const phone = phoneE164(typeof body.phone === 'string' ? body.phone : '')
  if (!phone) return NextResponse.json({ error: 'Escribe tu celular de 10 dígitos' }, { status: 400 })
  const [byIp, byPhone] = await Promise.all([overLimit(`accesslink:ip:${clientIp(request.headers)}`, 3600_000, 10), overLimit(`accesslink:p:${phone}`, 3600_000, 3)])
  if (byIp.blocked || byPhone.blocked) return NextResponse.json({ error: 'Pediste varios enlaces seguidos. Intenta más tarde.' }, { status: 429 })
  const users = await prisma.user.findMany({ where: { phone, isActive: true, role: { in: ['CLIENT', 'PARTNER'] } }, select: { id: true }, take: 2 })
  if (users.length === 1) await sendAccessLink(users[0].id).catch(() => null)
  return NextResponse.json({ ok: true, message: 'Si hay una cuenta con ese número, te enviamos el enlace por WhatsApp o a su correo.' })
}

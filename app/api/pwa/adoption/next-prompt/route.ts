import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { UserRole } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { getNextPwaPrompt } from '@/lib/pwa/adoption-strategy'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = session.user.role as UserRole
  if (!Object.values(UserRole).includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  if (role === 'ADMIN') {
    return NextResponse.json({ shouldShow: false, reason: 'admin_role' })
  }

  const result = await getNextPwaPrompt(session.user.id, role)
  return NextResponse.json(result)
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { maskAccountNumber } from '@/lib/admin/pagination'
import { getColombiaBankCatalog } from '@/lib/banking/catalog'
import { addBankAccount } from '@/lib/partners/ops'
import { APP_ORIGIN, OpsError, type Actor } from '@/lib/ops/origin'

const logger = createLogger('partner-bank-accounts')

async function sessionPartner(): Promise<{ actor: Actor; partnerId: string } | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  const profile = await prisma.partnerProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } })
  if (!profile) return null
  return { actor: { userId: session.user.id, role: session.user.role as Actor['role'], partnerId: profile.id, email: session.user.email ?? null }, partnerId: profile.id }
}

/** The partner's accounts as the browser sees them: account and document numbers show only their last 4 digits. */
async function listAccounts(partnerId: string) {
  const rows = await prisma.partnerBankAccount.findMany({ where: { partnerId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] })
  return rows.map((r) => ({ ...r, accountNumber: maskAccountNumber(r.accountNumber) ?? '', holderDocumentNumber: maskAccountNumber(r.holderDocumentNumber) ?? '' }))
}

export async function GET() {
  try {
    const ctx = await sessionPartner()
    if (!ctx) return NextResponse.json({ error: 'Perfil de socio no encontrado' }, { status: 404 })
    const [accounts, bankOptions] = await Promise.all([listAccounts(ctx.partnerId), getColombiaBankCatalog()])
    return NextResponse.json({ accounts, bankOptions })
  } catch (error) {
    logger.error('Error fetching partner bank accounts', error || undefined)
    return NextResponse.json({ error: 'Error al consultar cuentas bancarias' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await sessionPartner()
    if (!ctx) return NextResponse.json({ error: 'Perfil de socio no encontrado' }, { status: 404 })
    const body = await req.json()
    const account = await addBankAccount(ctx.actor, body, APP_ORIGIN)
    return NextResponse.json({ account: { ...account, accountNumber: maskAccountNumber(account.accountNumber) ?? '', holderDocumentNumber: maskAccountNumber(account.holderDocumentNumber) ?? '' } }, { status: 201 })
  } catch (error) {
    if (error instanceof OpsError) return NextResponse.json({ error: error.message }, { status: error.status })
    logger.error('Error creating partner bank account', error || undefined)
    return NextResponse.json({ error: 'Error al registrar cuenta bancaria' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await sessionPartner()
    if (!ctx) return NextResponse.json({ error: 'Perfil de socio no encontrado' }, { status: 404 })

    const body = await req.json()
    if (!body?.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const account = await prisma.partnerBankAccount.findFirst({ where: { id: body.id, partnerId: ctx.partnerId } })
    if (!account) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })

    if (body?.setDefault === true) {
      await prisma.$transaction([
        prisma.partnerBankAccount.updateMany({ where: { partnerId: ctx.partnerId }, data: { isDefault: false } }),
        prisma.partnerBankAccount.update({ where: { id: body.id }, data: { isDefault: true, isActive: true } }),
      ])
    }

    if (body?.isActive === false) {
      await prisma.partnerBankAccount.update({ where: { id: body.id }, data: { isActive: false, isDefault: false } })
    }

    return NextResponse.json({ accounts: await listAccounts(ctx.partnerId) })
  } catch (error) {
    logger.error('Error updating partner bank account', error || undefined)
    return NextResponse.json({ error: 'Error al actualizar cuenta bancaria' }, { status: 500 })
  }
}

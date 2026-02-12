import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

const logger = createLogger('partner-bank-accounts')

function normalizeAccountNumber(value: string) {
  return value.replace(/\D/g, '')
}

function validateColombianBankAccount(input: {
  bankName: string
  accountType: string
  accountNumber: string
  accountHolderName: string
  holderDocumentType: string
  holderDocumentNumber: string
}) {
  const accountNumber = normalizeAccountNumber(input.accountNumber)
  const docNumber = normalizeAccountNumber(input.holderDocumentNumber)

  if (!input.bankName?.trim()) return 'Banco requerido'
  if (!['SAVINGS', 'CHECKING'].includes(input.accountType)) return 'Tipo de cuenta inválido'
  if (accountNumber.length < 8 || accountNumber.length > 20) return 'Número de cuenta inválido'
  if (!input.accountHolderName?.trim()) return 'Titular requerido'
  if (!['CC', 'CE', 'NIT', 'PASSPORT'].includes(input.holderDocumentType)) return 'Tipo de documento inválido'
  if (docNumber.length < 5 || docNumber.length > 15) return 'Número de documento inválido'

  return null
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { partnerProfile: true },
    })

    if (!user?.partnerProfile) {
      return NextResponse.json({ error: 'Perfil de socio no encontrado' }, { status: 404 })
    }

    const accounts = await prisma.partnerBankAccount.findMany({
      where: { partnerId: user.partnerProfile.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ accounts })
  } catch (error) {
    logger.error('Error fetching partner bank accounts', error || undefined)
    return NextResponse.json({ error: 'Error al consultar cuentas bancarias' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { partnerProfile: true },
    })

    if (!user?.partnerProfile) {
      return NextResponse.json({ error: 'Perfil de socio no encontrado' }, { status: 404 })
    }

    const body = await req.json()
    const validationError = validateColombianBankAccount(body)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const accountNumber = normalizeAccountNumber(body.accountNumber)
    const holderDocumentNumber = normalizeAccountNumber(body.holderDocumentNumber)

    const existing = await prisma.partnerBankAccount.findFirst({
      where: {
        partnerId: user.partnerProfile.id,
        accountNumber,
        isActive: true,
      },
    })

    if (existing) {
      return NextResponse.json({ error: 'Esta cuenta ya está registrada' }, { status: 409 })
    }

    const hasDefault = await prisma.partnerBankAccount.findFirst({
      where: { partnerId: user.partnerProfile.id, isDefault: true, isActive: true },
      select: { id: true },
    })

    const account = await prisma.partnerBankAccount.create({
      data: {
        partnerId: user.partnerProfile.id,
        bankName: body.bankName.trim(),
        accountType: body.accountType,
        accountNumber,
        accountHolderName: body.accountHolderName.trim(),
        holderDocumentType: body.holderDocumentType,
        holderDocumentNumber,
        city: body.city?.trim() || null,
        branchCode: body.branchCode?.trim() || null,
        mercadoPagoRecipientId: body.mercadoPagoRecipientId?.trim() || null,
        isDefault: !hasDefault,
        isActive: true,
      },
    })

    return NextResponse.json({ account }, { status: 201 })
  } catch (error) {
    logger.error('Error creating partner bank account', error || undefined)
    return NextResponse.json({ error: 'Error al registrar cuenta bancaria' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { partnerProfile: true },
    })

    if (!user?.partnerProfile) {
      return NextResponse.json({ error: 'Perfil de socio no encontrado' }, { status: 404 })
    }

    const body = await req.json()
    if (!body?.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const account = await prisma.partnerBankAccount.findFirst({
      where: { id: body.id, partnerId: user.partnerProfile.id },
    })

    if (!account) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })

    if (body?.setDefault === true) {
      await prisma.$transaction([
        prisma.partnerBankAccount.updateMany({
          where: { partnerId: user.partnerProfile.id },
          data: { isDefault: false },
        }),
        prisma.partnerBankAccount.update({
          where: { id: body.id },
          data: { isDefault: true, isActive: true },
        }),
      ])
    }

    if (body?.isActive === false) {
      await prisma.partnerBankAccount.update({
        where: { id: body.id },
        data: { isActive: false, isDefault: false },
      })
    }

    const refreshed = await prisma.partnerBankAccount.findMany({
      where: { partnerId: user.partnerProfile.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ accounts: refreshed })
  } catch (error) {
    logger.error('Error updating partner bank account', error || undefined)
    return NextResponse.json({ error: 'Error al actualizar cuenta bancaria' }, { status: 500 })
  }
}

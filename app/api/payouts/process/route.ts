import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { processPayoutWithMercadoPago } from '@/lib/payout-processor'
import { createNotification } from '@/lib/notifications/notificationService'

const logger = createLogger('payouts-process')

async function processSinglePayout(payoutId: string, actorEmail: string) {
  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: {
      payment: {
        include: {
          booking: {
            include: {
              service: true,
            },
          },
        },
      },
      partner: {
        include: {
          user: true,
          bankAccounts: {
            where: { isActive: true },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            take: 1,
          },
        },
      },
    },
  })

  if (!payout) {
    return { payoutId, success: false, error: 'Pago no encontrado' }
  }

  if (payout.status !== 'PENDING') {
    return { payoutId, success: false, error: `Estado inválido: ${payout.status}` }
  }

  const bankAccount = payout.partner.bankAccounts[0]
  if (!bankAccount) {
    await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'FAILED',
        processorStatus: 'FAILED',
        processorMessage: 'Socio sin cuenta bancaria activa registrada',
        processedBy: actorEmail,
        processedAt: new Date(),
      },
    })

    return { payoutId, success: false, error: 'Socio sin cuenta bancaria activa' }
  }

  await prisma.payout.update({
    where: { id: payoutId },
    data: {
      status: 'PROCESSING',
      bankAccountId: bankAccount.id,
      processedBy: actorEmail,
    },
  })

  const providerResult = await processPayoutWithMercadoPago({
    payoutId,
    amount: payout.netAmount,
    reference: payout.paymentId,
    recipientId: bankAccount.mercadoPagoRecipientId,
  })

  const nextStatus = providerResult.success ? 'COMPLETED' : 'FAILED'

  const updatedPayout = await prisma.payout.update({
    where: { id: payoutId },
    data: {
      status: nextStatus,
      processedAt: new Date(),
      externalTransferId: providerResult.externalTransferId || null,
      processorStatus: providerResult.processorStatus,
      processorMessage: providerResult.processorMessage || null,
    },
  })

  if (providerResult.success) {
    await createNotification({
      userId: payout.partner.user?.id ?? payout.partner.userId,
      type: 'BOOKING_CONFIRMED',
      title: 'Pago procesado',
      message: `Se ha procesado tu pago de $${payout.netAmount.toLocaleString('es-CO')} COP`,
    })
  }

  return {
    payoutId,
    success: providerResult.success,
    payout: updatedPayout,
    provider: providerResult,
    bankAccount: {
      bankName: bankAccount.bankName,
      accountType: bankAccount.accountType,
      accountNumberMasked: `****${bankAccount.accountNumber.slice(-4)}`,
    },
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await req.json()
    const payoutId = body?.payoutId as string | undefined
    const payoutIds = Array.isArray(body?.payoutIds) ? (body.payoutIds as string[]) : []

    const ids = payoutId ? [payoutId] : payoutIds
    if (!ids.length) {
      return NextResponse.json({ error: 'payoutId o payoutIds es requerido' }, { status: 400 })
    }

    const results = []
    for (const id of ids) {
      try {
        const result = await processSinglePayout(id, session.user.email || 'admin')
        results.push(result)
      } catch (error: any) {
        logger.error('Error processing payout', { payoutId: id, error: error?.message || error })
        results.push({ payoutId: id, success: false, error: error?.message || 'Error al procesar payout' })
      }
    }

    const summary = {
      total: results.length,
      success: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    }

    return NextResponse.json({ summary, results })
  } catch (error) {
    logger.error('Error al procesar pago', error || undefined)
    return NextResponse.json({ error: 'Error al procesar pago' }, { status: 500 })
  }
}

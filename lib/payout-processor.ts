import { PaymentEnvironment } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getMercadoPagoRuntimeConfig } from '@/lib/mercadopago'

type PayoutProcessResult = {
  success: boolean
  externalTransferId?: string
  processorStatus: string
  processorMessage?: string
}

type ProcessPayoutInput = {
  payoutId: string
  amount: number
  reference: string
  recipientId?: string | null
}

export async function getPaymentEnvironment(): Promise<PaymentEnvironment> {
  const config = await prisma.paymentConfig.findFirst()
  return config?.environment || 'TEST'
}

export async function processPayoutWithMercadoPago(input: ProcessPayoutInput): Promise<PayoutProcessResult> {
  const environment = await getPaymentEnvironment()

  if (environment === 'TEST') {
    return {
      success: true,
      externalTransferId: `test_${input.payoutId}`,
      processorStatus: 'TEST_COMPLETED',
      processorMessage: 'Payout simulado en modo TEST',
    }
  }

  const runtime = await getMercadoPagoRuntimeConfig('PRODUCTION')
  const endpoint = process.env.MERCADOPAGO_PAYOUTS_API_URL || 'https://api.mercadopago.com/v1/transfers'

  if (!input.recipientId) {
    return {
      success: false,
      processorStatus: 'FAILED',
      processorMessage: 'Cuenta sin recipient_id de Mercado Pago para producción',
    }
  }

  const payload = {
    amount: Number(input.amount.toFixed(2)),
    external_reference: input.reference,
    description: `Pago a socio ${input.reference}`,
    recipient_id: input.recipientId,
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${runtime.accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `payout-${input.payoutId}`,
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      success: false,
      processorStatus: 'FAILED',
      processorMessage: body?.message || `Mercado Pago error ${response.status}`,
    }
  }

  return {
    success: true,
    externalTransferId: body?.id?.toString?.() || body?.transfer_id?.toString?.(),
    processorStatus: body?.status?.toString?.() || 'COMPLETED',
    processorMessage: body?.status_detail?.toString?.() || 'Transferencia enviada',
  }
}


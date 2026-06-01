import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const config = await prisma.platformConfig.findFirst({
    select: {
      commissionEnabled: true,
      cashEnabled: true,
      transferEnabled: true,
      mercadoPagoEnabled: true,
      clientCommissionRate: true,
      partnerCommissionRate: true,
    },
  })

  return NextResponse.json({
    commissionEnabled: config?.commissionEnabled ?? false,
    cashEnabled: config?.cashEnabled ?? true,
    transferEnabled: config?.transferEnabled ?? true,
    mercadoPagoEnabled: config?.mercadoPagoEnabled ?? false,
    clientCommissionRate: config?.clientCommissionRate ?? 0,
    partnerCommissionRate: config?.partnerCommissionRate ?? 0,
  })
}

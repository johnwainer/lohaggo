import { NextResponse } from 'next/server'
import { effectiveRates, loadPlatformConfigRow } from '@/lib/payments/commission'

export async function GET() {
  const config = await loadPlatformConfigRow()
  const rates = effectiveRates(config)

  return NextResponse.json({
    commissionEnabled: rates.enabled,
    cashEnabled: config?.cashEnabled ?? true,
    transferEnabled: config?.transferEnabled ?? true,
    mercadoPagoEnabled: config?.mercadoPagoEnabled ?? false,
    clientCommissionRate: rates.client,
    partnerCommissionRate: rates.partner,
  })
}

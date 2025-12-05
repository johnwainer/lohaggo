import { NextResponse } from 'next/server'
import { getMercadoPagoConfig } from '@/lib/mercadopago'
import { createLogger } from '@/lib/logger'

const logger = createLogger('mercadopago-public-key')

export async function GET() {
  try {
    const { publicKey } = await getMercadoPagoConfig()
    return NextResponse.json({ publicKey })
  } catch (error) {
    logger.error('Error getting public key:', error || undefined)
    return NextResponse.json({ error: 'Failed to get public key' }, { status: 500 })
  }
}

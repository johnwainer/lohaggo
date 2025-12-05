import { NextResponse } from 'next/server'
import { getMercadoPagoClient } from '@/lib/mercadopago'
import { createLogger } from '@/lib/logger'

const logger = createLogger('mercadopago-public-key')

export async function GET() {
  try {
    const { publicKey } = await getMercadoPagoClient()
    return NextResponse.json({ publicKey })
  } catch (error) {
    logger.error('Error getting public key:', error || undefined)
    return NextResponse.json({ error: 'Failed to get public key' }, { status: 500 })
  }
}

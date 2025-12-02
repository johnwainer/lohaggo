import { NextResponse } from 'next/server'
import { getMercadoPagoPublicKey } from '@/lib/mercadopago'

export async function GET() {
  try {
    const publicKey = await getMercadoPagoPublicKey()
    return NextResponse.json({ publicKey })
  } catch (error) {
    console.error('Error getting public key:', error)
    return NextResponse.json({ error: 'Error al obtener clave pública' }, { status: 500 })
  }
}

import { MercadoPagoConfig } from 'mercadopago'
import { prisma } from './prisma'

let cachedConfig: { client: MercadoPagoConfig; publicKey: string } | null = null
let lastFetch = 0
const CACHE_TTL = 5 * 60 * 1000

export async function getMercadoPagoClient() {
  const now = Date.now()

  if (cachedConfig && (now - lastFetch) < CACHE_TTL) {
    return cachedConfig
  }

  try {
    const config = await prisma.paymentConfig.findFirst()

    if (!config) {
      throw new Error('No payment configuration found')
    }

    const isProduction = config.environment === 'PRODUCTION'
    const accessToken = isProduction ? config.productionAccessToken : config.testAccessToken
    const publicKey = isProduction ? config.productionPublicKey : config.testPublicKey

    if (!accessToken || !publicKey) {
      throw new Error(`Missing ${isProduction ? 'production' : 'test'} credentials`)
    }

    const client = new MercadoPagoConfig({
      accessToken,
    })

    cachedConfig = { client, publicKey }
    lastFetch = now

    return cachedConfig
  } catch (error) {
    console.error('Error getting MercadoPago config:', error)

    const fallbackToken = process.env.MERCADOPAGO_ACCESS_TOKEN || ''
    const fallbackPublicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || ''

    if (!fallbackToken) {
      throw new Error('No MercadoPago credentials available')
    }

    const client = new MercadoPagoConfig({
      accessToken: fallbackToken,
    })

    return { client, publicKey: fallbackPublicKey }
  }
}

export async function getMercadoPagoPublicKey() {
  const config = await getMercadoPagoClient()
  return config.publicKey
}
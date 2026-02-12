import { MercadoPagoConfig } from 'mercadopago'
import { prisma } from './prisma'

let cachedConfig: { client: MercadoPagoConfig; publicKey: string } | null = null
let lastFetch = 0
const CACHE_TTL = 5 * 60 * 1000

export type MercadoPagoRuntimeConfig = {
  environment: 'TEST' | 'PRODUCTION'
  accessToken: string
  publicKey: string
  source: 'db' | 'env'
}

export async function getMercadoPagoRuntimeConfig(
  preferredEnvironment?: 'TEST' | 'PRODUCTION'
): Promise<MercadoPagoRuntimeConfig> {
  const config = await prisma.paymentConfig.findFirst()

  const selectedEnvironment = preferredEnvironment || config?.environment || 'TEST'
  const isProduction = selectedEnvironment === 'PRODUCTION'

  const dbAccessToken = isProduction ? config?.productionAccessToken : config?.testAccessToken
  const dbPublicKey = isProduction ? config?.productionPublicKey : config?.testPublicKey

  if (dbAccessToken && dbPublicKey) {
    return {
      environment: selectedEnvironment,
      accessToken: dbAccessToken,
      publicKey: dbPublicKey,
      source: 'db',
    }
  }

  const fallbackToken = process.env.MERCADOPAGO_ACCESS_TOKEN || ''
  const fallbackPublicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || ''

  if (!fallbackToken) {
    throw new Error(`Missing MercadoPago credentials for ${selectedEnvironment}`)
  }

  return {
    environment: selectedEnvironment,
    accessToken: fallbackToken,
    publicKey: fallbackPublicKey,
    source: 'env',
  }
}

export async function validateMercadoPagoAccessToken(accessToken: string) {
  try {
    const response = await fetch('https://api.mercadopago.com/users/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    const body = await response.json().catch(() => ({}))
    return {
      ok: response.ok,
      status: response.status,
      account: response.ok
        ? {
            id: body?.id,
            nickname: body?.nickname,
            email: body?.email,
            siteId: body?.site_id,
          }
        : null,
      error: response.ok ? null : body?.message || 'Invalid MercadoPago token',
    }
  } catch (error: any) {
    return {
      ok: false,
      status: 0,
      account: null,
      error: error?.message || 'Error validating MercadoPago token',
    }
  }
}

export async function getMercadoPagoClient() {
  const now = Date.now()

  if (cachedConfig && (now - lastFetch) < CACHE_TTL) {
    return cachedConfig
  }

  try {
    const runtimeConfig = await getMercadoPagoRuntimeConfig()

    const client = new MercadoPagoConfig({
      accessToken: runtimeConfig.accessToken,
    })

    cachedConfig = { client, publicKey: runtimeConfig.publicKey }
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

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { validateMercadoPagoAccessToken } from '@/lib/mercadopago'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'

const logger = createLogger('admin-payment-config')
const SUPERADMIN_ONLY = 'Solo un superadmin puede cambiar esto'

type Config = NonNullable<Awaited<ReturnType<typeof prisma.paymentConfig.findFirst>>>

function summary(config: Config) {
  const activeToken = config.environment === 'PRODUCTION' ? config.productionAccessToken : config.testAccessToken
  return {
    id: config.id,
    environment: config.environment,
    hasTestCredentials: !!(config.testAccessToken && config.testPublicKey && config.testClientId && config.testClientSecret),
    hasProductionCredentials: !!(config.productionAccessToken && config.productionPublicKey && config.productionClientId && config.productionClientSecret),
    testPublicKey: config.testPublicKey,
    testClientId: config.testClientId,
    productionPublicKey: config.productionPublicKey,
    productionClientId: config.productionClientId,
    // Configured, not validated: MercadoPago is only called on save or with «Probar conexión».
    activeEnvironmentReady: !!activeToken,
    updatedAt: config.updatedAt,
  }
}

/** Reads without calling MercadoPago: validating is on save or on demand (POST action 'test'). */
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    let config = await prisma.paymentConfig.findFirst()
    if (!config) {
      config = await prisma.paymentConfig.create({ data: { environment: 'TEST' } })
    }

    return NextResponse.json({ ...summary(config), canEdit: admin.isSuperAdmin, validation: null })
  } catch (error) {
    logger.error('Error fetching payment config:', error || undefined)
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 })
  }
}

/** On-demand check of the saved access tokens against MercadoPago. Read-only, so any admin can run it. */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    if (body?.action !== 'test') {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
    }

    const config = await prisma.paymentConfig.findFirst()
    if (!config) return NextResponse.json({ error: 'No hay configuración de pagos guardada' }, { status: 404 })

    const [test, production] = await Promise.all([
      config.testAccessToken ? validateMercadoPagoAccessToken(config.testAccessToken) : Promise.resolve(null),
      config.productionAccessToken ? validateMercadoPagoAccessToken(config.productionAccessToken) : Promise.resolve(null),
    ])
    const active = config.environment === 'PRODUCTION' ? production : test

    return NextResponse.json({
      ...summary(config),
      canEdit: admin.isSuperAdmin,
      activeEnvironmentValidated: !!active?.ok,
      validation: { test, production, checkedAt: new Date().toISOString() },
    })
  } catch (error) {
    logger.error('Error testing payment config:', error || undefined)
    return NextResponse.json({ error: 'Error al probar la conexión' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!admin.isSuperAdmin) return NextResponse.json({ error: SUPERADMIN_ONLY }, { status: 403 })

    const body = await request.json()
    const {
      environment,
      testAccessToken,
      testPublicKey,
      testClientId,
      testClientSecret,
      productionAccessToken,
      productionPublicKey,
      productionClientId,
      productionClientSecret
    } = body

    let config = await prisma.paymentConfig.findFirst()

    const selectedEnvironment = environment || config?.environment || 'TEST'
    const selectedAccessToken =
      selectedEnvironment === 'PRODUCTION'
        ? (productionAccessToken || config?.productionAccessToken)
        : (testAccessToken || config?.testAccessToken)

    if (!selectedAccessToken) {
      return NextResponse.json(
        { error: `Debes configurar access token para ${selectedEnvironment}` },
        { status: 400 }
      )
    }

    const tokenValidation = await validateMercadoPagoAccessToken(selectedAccessToken)
    if (!tokenValidation.ok) {
      return NextResponse.json(
        { error: `Credenciales inválidas para ${selectedEnvironment}: ${tokenValidation.error}` },
        { status: 400 }
      )
    }

    if (!config) {
      config = await prisma.paymentConfig.create({
        data: {
          environment: selectedEnvironment,
          testAccessToken,
          testPublicKey,
          testClientId,
          testClientSecret,
          productionAccessToken,
          productionPublicKey,
          productionClientId,
          productionClientSecret
        }
      })
    } else {
      config = await prisma.paymentConfig.update({
        where: { id: config.id },
        data: {
          environment: selectedEnvironment,
          ...(testAccessToken && { testAccessToken }),
          ...(testPublicKey && { testPublicKey }),
          ...(testClientId && { testClientId }),
          ...(testClientSecret && { testClientSecret }),
          ...(productionAccessToken && { productionAccessToken }),
          ...(productionPublicKey && { productionPublicKey }),
          ...(productionClientId && { productionClientId }),
          ...(productionClientSecret && { productionClientSecret })
        }
      })
    }

    const changed = Object.entries({
      testAccessToken, testPublicKey, testClientId, testClientSecret,
      productionAccessToken, productionPublicKey, productionClientId, productionClientSecret,
    }).filter(([, v]) => !!v).map(([k]) => k)
    await auditAdminAction({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'payment_config.update',
      entityType: 'PaymentConfig',
      entityId: config.id,
      route: '/api/admin/payment-config',
      details: `ambiente ${config.environment}${changed.length ? ` · campos: ${changed.join(', ')}` : ''}`,
      request,
    })

    const validation = { [selectedEnvironment === 'PRODUCTION' ? 'production' : 'test']: tokenValidation, checkedAt: new Date().toISOString() }
    return NextResponse.json({
      ...summary(config),
      canEdit: true,
      activeEnvironmentValidated: true,
      validation,
    })
  } catch (error) {
    logger.error('Error updating payment config:', error || undefined)
    return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 })
  }
}

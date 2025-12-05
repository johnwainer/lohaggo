import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

const logger = createLogger('admin-payment-config')

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    let config = await prisma.paymentConfig.findFirst()

    if (!config) {
      config = await prisma.paymentConfig.create({
        data: {
          environment: 'TEST'
        }
      })
    }

    return NextResponse.json({
      id: config.id,
      environment: config.environment,
      hasTestCredentials: !!(config.testAccessToken && config.testPublicKey && config.testClientId && config.testClientSecret),
      hasProductionCredentials: !!(config.productionAccessToken && config.productionPublicKey && config.productionClientId && config.productionClientSecret),
      testPublicKey: config.testPublicKey,
      testClientId: config.testClientId,
      productionPublicKey: config.productionPublicKey,
      productionClientId: config.productionClientId
    })
  } catch (error) {
    logger.error('Error fetching payment config:', error || undefined)
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

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

    if (!config) {
      config = await prisma.paymentConfig.create({
        data: {
          environment: environment || 'TEST',
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
          environment,
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

    return NextResponse.json({
      id: config.id,
      environment: config.environment,
      hasTestCredentials: !!(config.testAccessToken && config.testPublicKey && config.testClientId && config.testClientSecret),
      hasProductionCredentials: !!(config.productionAccessToken && config.productionPublicKey && config.productionClientId && config.productionClientSecret)
    })
  } catch (error) {
    logger.error('Error updating payment config:', error || undefined)
    return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 })
  }
}

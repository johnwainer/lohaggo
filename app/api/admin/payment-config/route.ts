import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

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
      hasTestCredentials: !!(config.testAccessToken && config.testPublicKey),
      hasProductionCredentials: !!(config.productionAccessToken && config.productionPublicKey),
      testPublicKey: config.testPublicKey,
      productionPublicKey: config.productionPublicKey
    })
  } catch (error) {
    console.error('Error fetching payment config:', error)
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
    const { environment, testAccessToken, testPublicKey, productionAccessToken, productionPublicKey } = body

    let config = await prisma.paymentConfig.findFirst()

    if (!config) {
      config = await prisma.paymentConfig.create({
        data: {
          environment: environment || 'TEST',
          testAccessToken,
          testPublicKey,
          productionAccessToken,
          productionPublicKey
        }
      })
    } else {
      config = await prisma.paymentConfig.update({
        where: { id: config.id },
        data: {
          environment,
          testAccessToken,
          testPublicKey,
          productionAccessToken,
          productionPublicKey
        }
      })
    }

    return NextResponse.json({
      id: config.id,
      environment: config.environment,
      hasTestCredentials: !!(config.testAccessToken && config.testPublicKey),
      hasProductionCredentials: !!(config.productionAccessToken && config.productionPublicKey)
    })
  } catch (error) {
    console.error('Error updating payment config:', error)
    return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 })
  }
}

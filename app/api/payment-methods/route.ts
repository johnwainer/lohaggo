import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import mercadopago from '@/lib/mercadopago'
import { createLogger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequest } from '@/lib/validation'

const logger = createLogger('payment-methods')

function extractMercadoPagoError(error: any): string {
  if (!error) return 'Error al comunicarse con Mercado Pago'
  if (error.message) return error.message
  if (error.error) return error.error
  if (Array.isArray(error.cause) && error.cause.length > 0) {
    return error.cause[0]?.description || error.cause[0]?.code || 'Error en Mercado Pago'
  }
  return 'Error en Mercado Pago'
}

const paymentMethodCreateSchema = z.object({
  cardNumber: z.string().regex(/^\d{13,19}$/, 'Número de tarjeta inválido'),
  cardholderName: z.string().min(2, 'Nombre del titular inválido').max(100),
  expirationMonth: z.number().int().min(1, 'Mes de vencimiento inválido').max(12, 'Mes de vencimiento inválido'),
  expirationYear: z.number().int().min(new Date().getFullYear(), 'Año de vencimiento inválido'),
  cvv: z.string().regex(/^\d{3,4}$/, 'CVV inválido'),
  setDefault: z.boolean().optional()
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (session.user.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Solo clientes pueden acceder' }, { status: 403 })
    }

    const paymentMethods = await prisma.paymentMethod.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        lastFourDigits: true,
        cardBrand: true,
        cardholderName: true,
        expirationMonth: true,
        expirationYear: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
      },
    })

    return NextResponse.json(paymentMethods)
  } catch (error) {
    logger.error('Error fetching payment methods', error)
    return NextResponse.json(
      { error: 'Error al obtener métodos de pago' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'Mercado Pago no está configurado' }, { status: 500 })
    }

    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (session.user.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Solo clientes pueden acceder' }, { status: 403 })
    }

    logger.debug('Processing payment method creation', { userId: session.user.id })

    const body = await request.json()

    const validation = await validateRequest(paymentMethodCreateSchema, body, false)
    if (!validation.success) {
      return validation.error
    }

    const {
      cardNumber,
      cardholderName,
      expirationMonth,
      expirationYear,
      cvv,
      setDefault,
    } = validation.data
      return NextResponse.json({ error: 'Mes de vencimiento inválido' }, { status: 400 })
    }

    if (!Number.isInteger(expirationYear) || expirationYear < new Date().getFullYear() || expirationYear > new Date().getFullYear() + 20) {
      return NextResponse.json({ error: 'Año de vencimiento inválido' }, { status: 400 })
    }

    if (typeof cvv !== 'string' || cvv.length < 3 || cvv.length > 4) {
      return NextResponse.json({ error: 'CVV inválido' }, { status: 400 })
    }

    const userId = session.user.id
    const userEmail = session.user.email!
    const userName = session.user.name ?? ''

    let customerId: string | null = null

    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
    }).catch(() => null)

    if (userRecord) {
      customerId = (userRecord as any).mercadopagoCustomerId || null
    }

    if (!customerId) {
      const search = await mercadopago.customer
        .search({ options: { email: userEmail } })
        .catch(() => null)

      const existingCustomer = search?.results?.[0]

      if (existingCustomer?.id) {
        customerId = existingCustomer.id
        await prisma.user.update({
          where: { id: userId },
          data: { mercadopagoCustomerId: customerId } as any,
        }).catch((err) => {
          logger.warn('Failed to update mercadopagoCustomerId', { userId, error: err.message })
        })
      } else {
        const [firstName = userName, ...rest] = (userName || '').split(' ').filter(Boolean)
        const lastName = rest.join(' ') || undefined

        const createdCustomer = await mercadopago.customer
          .create({
            body: {
              email: userEmail,
              first_name: firstName,
              last_name: lastName,
              description: `Usuario ${userId}`,
            },
          })
          .catch((err: any) => {
            throw new Error(extractMercadoPagoError(err))
          })

        if (!createdCustomer?.id) {
          return NextResponse.json({ error: 'No se pudo crear el cliente en Mercado Pago' }, { status: 500 })
        }

        customerId = createdCustomer.id

        await prisma.user.update({
          where: { id: userId },
          data: { mercadopagoCustomerId: customerId } as any,
        }).catch((err) => {
          logger.warn('Failed to update mercadopagoCustomerId', { userId, error: err.message })
        })
      }
    }

    if (!customerId) {
      return NextResponse.json({ error: 'No se pudo obtener el cliente de Mercado Pago' }, { status: 500 })
    }

    const sanitizedNumber = cardNumber.replace(/\s+/g, '')

    const shouldSetDefault = setDefault === true

    const cardToken = await mercadopago.cardToken
      .create({
        body: {
          card_number: sanitizedNumber,
          expiration_month: expirationMonth,
          expiration_year: expirationYear,
          security_code: cvv,
          cardholder: { name: cardholderName },
        } as any,
      })
      .catch((err: any) => {
        throw new Error(extractMercadoPagoError(err))
      })

    if (!cardToken?.id) {
      return NextResponse.json({ error: 'No se pudo generar el token de la tarjeta' }, { status: 500 })
    }

    const customerCard = await mercadopago.customer
      .createCard({
        customerId,
        body: {
          token: cardToken.id,
        },
      })
      .catch((err: any) => {
        throw new Error(extractMercadoPagoError(err))
      })

    if (!customerCard?.id) {
      return NextResponse.json({ error: 'No se pudo registrar la tarjeta' }, { status: 500 })
    }

    const lastFour = customerCard.last_four_digits || cardToken.last_four_digits || sanitizedNumber.slice(-4)
    const cardBrand = customerCard.payment_method?.name || customerCard.payment_method?.id || 'Tarjeta'

    const paymentMethod = await prisma.$transaction(async (tx) => {
      if (shouldSetDefault) {
        await tx.paymentMethod.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        })
      }

      return tx.paymentMethod.create({
        data: {
          userId,
          mercadopagoCardId: customerCard.id,
          cardToken: cardToken.id,
          lastFourDigits: lastFour,
          cardBrand,
          cardholderName,
          expirationMonth,
          expirationYear,
          isDefault: shouldSetDefault,
        },
      })
    })

    if (shouldSetDefault && customerCard.id) {
      mercadopago.customer
        .update({
          customerId,
          body: { default_card: customerCard.id },
        })
        .catch(() => null)
    }

    return NextResponse.json(
      {
        id: paymentMethod.id,
        lastFourDigits: paymentMethod.lastFourDigits,
        cardBrand: paymentMethod.cardBrand,
        cardholderName: paymentMethod.cardholderName,
        expirationMonth: paymentMethod.expirationMonth,
        expirationYear: paymentMethod.expirationYear,
        isDefault: paymentMethod.isDefault,
      },
      { status: 201 }
    )
  } catch (error: any) {
    logger.error('Error creating payment method', error)
    return NextResponse.json(
      { error: error?.message || 'Error al registrar el método de pago' },
      { status: 500 }
    )
  }
}

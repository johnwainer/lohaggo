import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixMissingPayouts() {
  try {
    console.log('🔍 Buscando pagos aprobados sin payout...')

    const paymentsWithoutPayout = await prisma.payment.findMany({
      where: {
        status: 'APPROVED',
        payout: null,
      },
      include: {
        booking: {
          include: {
            partner: true,
          },
        },
      },
    })

    console.log(`📊 Encontrados ${paymentsWithoutPayout.length} pagos sin payout`)

    if (paymentsWithoutPayout.length === 0) {
      console.log('✅ No hay pagos sin payout')
      return
    }

    const config = await prisma.platformConfig.findFirst()

    if (!config) {
      console.error('❌ No se encontró configuración de la plataforma')
      return
    }

    const partnerCommissionRate = Number(config.partnerCommissionRate)

    console.log(`📋 Usando comisión de socio: ${partnerCommissionRate}%`)

    let created = 0
    let skipped = 0

    for (const payment of paymentsWithoutPayout) {
      if (!payment.booking.partnerId) {
        console.log(`⚠️  Pago ${payment.id} no tiene partner asignado, omitiendo...`)
        skipped++
        continue
      }

      const serviceAmount = Number(payment.serviceAmount ?? payment.totalAmount ?? 0)
      const partnerCommission = (serviceAmount * partnerCommissionRate) / 100
      const netAmount = serviceAmount - partnerCommission

      await prisma.payout.create({
        data: {
          paymentId: payment.id,
          partnerId: payment.booking.partnerId,
          amount: serviceAmount,
          partnerCommission,
          partnerCommissionRate,
          netAmount,
          status: 'PENDING',
        },
      })

      console.log(`✅ Payout creado para pago ${payment.id}`)
      created++
    }

    console.log('\n📈 Resumen:')
    console.log(`   ✅ Payouts creados: ${created}`)
    console.log(`   ⚠️  Omitidos (sin partner): ${skipped}`)
    console.log(`   📊 Total procesados: ${paymentsWithoutPayout.length}`)
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixMissingPayouts()

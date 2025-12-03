import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updatePaymentConfig() {
  try {
    console.log('🔄 Actualizando configuración de pagos...\n')

    const config = await prisma.paymentConfig.findFirst()

    if (!config) {
      console.log('❌ No se encontró configuración. Ejecuta primero check-payment-config.ts')
      return
    }

    const testAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    const testPublicKey = process.env.MERCADOPAGO_PUBLIC_KEY

    if (!testAccessToken || !testPublicKey) {
      console.log('❌ Error: Faltan variables de entorno')
      console.log('   MERCADOPAGO_ACCESS_TOKEN:', testAccessToken ? '✅' : '❌')
      console.log('   MERCADOPAGO_PUBLIC_KEY:', testPublicKey ? '✅' : '❌')
      return
    }

    const updated = await prisma.paymentConfig.update({
      where: { id: config.id },
      data: {
        testAccessToken,
        testPublicKey,
      },
    })

    console.log('✅ Configuración actualizada exitosamente:\n')
    console.log('📊 Detalles:')
    console.log('─'.repeat(60))
    console.log(`ID: ${updated.id}`)
    console.log(`Ambiente: ${updated.environment}`)
    console.log(`Test Access Token: ${updated.testAccessToken ? '✅ Configurado' : '❌ No configurado'}`)
    console.log(`Test Public Key: ${updated.testPublicKey ? '✅ Configurado' : '❌ No configurado'}`)
    console.log('─'.repeat(60))

  } catch (error) {
    console.error('❌ Error al actualizar la configuración:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updatePaymentConfig()

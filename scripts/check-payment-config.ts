import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkPaymentConfig() {
  try {
    console.log('🔍 Verificando configuración de pagos en la base de datos...\n')

    const config = await prisma.paymentConfig.findFirst()

    if (!config) {
      console.log('❌ No se encontró configuración de pagos en la base de datos.')
      console.log('\n📝 Creando configuración inicial...\n')

      const newConfig = await prisma.paymentConfig.create({
        data: {
          environment: 'TEST',
          testAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || null,
          testPublicKey: process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || null,
          testClientId: null,
          testClientSecret: null,
          productionAccessToken: null,
          productionPublicKey: null,
          productionClientId: null,
          productionClientSecret: null,
        },
      })

      console.log('✅ Configuración creada exitosamente:')
      console.log(JSON.stringify(newConfig, null, 2))
    } else {
      console.log('✅ Configuración encontrada en la base de datos:\n')
      console.log('📊 Detalles de la configuración:')
      console.log('─'.repeat(60))
      console.log(`ID: ${config.id}`)
      console.log(`Ambiente: ${config.environment}`)
      console.log(`Creado: ${config.createdAt}`)
      console.log(`Actualizado: ${config.updatedAt}`)
      console.log('─'.repeat(60))
      
      console.log('\n🔑 Credenciales TEST:')
      console.log(`  Access Token: ${config.testAccessToken ? '✅ Configurado' : '❌ No configurado'}`)
      console.log(`  Public Key: ${config.testPublicKey ? '✅ Configurado' : '❌ No configurado'}`)
      console.log(`  Client ID: ${config.testClientId ? '✅ Configurado' : '❌ No configurado'}`)
      console.log(`  Client Secret: ${config.testClientSecret ? '✅ Configurado' : '❌ No configurado'}`)
      
      console.log('\n🔑 Credenciales PRODUCTION:')
      console.log(`  Access Token: ${config.productionAccessToken ? '✅ Configurado' : '❌ No configurado'}`)
      console.log(`  Public Key: ${config.productionPublicKey ? '✅ Configurado' : '❌ No configurado'}`)
      console.log(`  Client ID: ${config.productionClientId ? '✅ Configurado' : '❌ No configurado'}`)
      console.log(`  Client Secret: ${config.productionClientSecret ? '✅ Configurado' : '❌ No configurado'}`)

      console.log('\n📌 Ambiente actual:', config.environment === 'TEST' ? '🧪 TEST' : '🚀 PRODUCTION')
      
      if (config.environment === 'TEST') {
        if (!config.testAccessToken || !config.testPublicKey) {
          console.log('\n⚠️  ADVERTENCIA: Faltan credenciales TEST')
          console.log('   El sistema usará las credenciales de .env.local como fallback')
        } else {
          console.log('\n✅ Credenciales TEST configuradas correctamente')
        }
      } else {
        if (!config.productionAccessToken || !config.productionPublicKey) {
          console.log('\n❌ ERROR: Faltan credenciales PRODUCTION')
          console.log('   El sistema NO puede funcionar en modo PRODUCTION sin credenciales')
        } else {
          console.log('\n✅ Credenciales PRODUCTION configuradas correctamente')
        }
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('📚 Información adicional:')
    console.log('='.repeat(60))
    console.log('• Las credenciales se toman de la base de datos')
    console.log('• Si no hay credenciales en DB, se usa .env.local como fallback')
    console.log('• El ambiente se controla desde el modelo PaymentConfig')
    console.log('• Para cambiar el ambiente, actualiza el campo "environment"')
    console.log('='.repeat(60))

  } catch (error) {
    console.error('❌ Error al verificar la configuración:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkPaymentConfig()

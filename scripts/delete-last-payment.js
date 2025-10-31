const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function deleteLastPayment() {
  try {
    // Obtener el último pago
    const lastPayment = await prisma.payment.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        booking: {
          include: {
            service: true,
            user: true,
          },
        },
        payout: true,
      },
    })

    if (!lastPayment) {
      console.log('❌ No se encontraron pagos en la base de datos')
      return
    }

    console.log('\n📋 Último pago encontrado:')
    console.log(`  ID: ${lastPayment.id}`)
    console.log(`  Booking ID: ${lastPayment.bookingId}`)
    console.log(`  Cliente: ${lastPayment.booking.user.name}`)
    console.log(`  Servicio: ${lastPayment.booking.service.name}`)
    console.log(`  Monto: $${lastPayment.totalAmount.toLocaleString('es-CO')}`)
    console.log(`  Estado: ${lastPayment.status}`)
    console.log(`  Fecha: ${lastPayment.createdAt.toLocaleString('es-CO')}`)

    // Eliminar el payout asociado si existe
    if (lastPayment.payout) {
      await prisma.payout.delete({
        where: { id: lastPayment.payout.id },
      })
      console.log('\n✅ Payout eliminado')
    }

    // Eliminar el pago
    await prisma.payment.delete({
      where: { id: lastPayment.id },
    })
    console.log('✅ Pago eliminado')

    // Actualizar el estado del booking a PENDING
    await prisma.booking.update({
      where: { id: lastPayment.bookingId },
      data: {
        status: 'PENDING',
      },
    })
    console.log('✅ Booking actualizado a PENDING')

    console.log('\n✨ El servicio ahora está como si no se hubiera pagado\n')
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

deleteLastPayment()

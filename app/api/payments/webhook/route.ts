import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import mercadopago from '@/lib/mercadopago';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data } = body;

    if (type === 'payment') {
      const paymentId = data?.id;
      if (!paymentId) {
        console.log('Webhook payment sin id:', body);
        return NextResponse.json({ received: true });
      }

      const payment = await prisma.payment.findFirst({
        where: { mercadopagoId: String(paymentId) },
      });

      if (!payment) {
        console.log('Pago no encontrado en BD:', paymentId);
        return NextResponse.json({ received: true });
      }

      // Obtener detalle del pago desde MercadoPago
      const mpResponse = await mercadopago.payment.get({ id: String(paymentId) });
      const mpPayment = mpResponse;

      const mpStatusRaw = (mpPayment?.status ?? '').toString().toLowerCase();

      let status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' = 'PENDING';

      switch (mpStatusRaw) {
        case 'approved':
          status = 'APPROVED';
          break;
        case 'rejected':
          status = 'REJECTED';
          break;
        case 'cancelled':
        case 'cancelled_by_user':
          status = 'CANCELLED';
          break;
        case 'in_process':
        case 'in_mediation':
        default:
          status = 'PENDING';
      }

      // Guardar respuesta cruda de MP y estado
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status,
          mercadopagoId: String(paymentId),
          paidAt: status === 'APPROVED' ? (payment.paidAt ?? new Date()) : null,
        },
      });

      if (status === 'APPROVED') {
        const booking = await prisma.booking.update({
          where: { id: payment.bookingId },
          data: { status: 'CONFIRMED' },
          include: {
            user: true,
            partner: {
              include: {
                user: true,
              },
            },
          },
        });

        // Notificar al cliente
        await prisma.notification.create({
          data: {
            userId: booking.userId,
            type: 'BOOKING_CONFIRMED',
            title: 'Pago recibido',
            message: `Tu pago de $${payment.totalAmount?.toLocaleString('es-CO') ?? payment.totalAmount} COP ha sido confirmado.`,
          },
        });

        // Notificar al partner si tiene suscripción push
        if (booking.partner?.user?.pushSubscription) {
          await prisma.notification.create({
            data: {
              userId: booking.partner.user.id,
              type: 'BOOKING_CONFIRMED',
              title: 'Nueva reserva confirmada',
              message: `${booking.user?.name ?? 'Un cliente'} ha confirmado el pago. La reserva está lista.`,
            },
          });
        }

        // Generar payout para el partner usando la tarifa guardada en el booking
        let partnerCommissionRate: number;

        if (booking.partnerCommissionRate !== null && booking.partnerCommissionRate !== undefined) {
          partnerCommissionRate = Number(booking.partnerCommissionRate);
          console.log('✅ Usando tarifa de socio guardada en el booking:', partnerCommissionRate);
        } else {
          const config = await prisma.platformConfig.findFirst();
          if (!config) {
            console.error('No se encontró configuración de la plataforma');
            return NextResponse.json({ received: true });
          }
          partnerCommissionRate = Number(config.partnerCommissionRate);
          console.log('⚠️ Usando tarifa de socio actual de la plataforma:', partnerCommissionRate);
        }

        const serviceAmount = Number(payment.serviceAmount ?? payment.totalAmount ?? 0);
        const partnerCommission = (serviceAmount * partnerCommissionRate) / 100;
        const netAmount = serviceAmount - partnerCommission;

        console.log('💰 Creando payout:', {
          serviceAmount,
          partnerCommissionRate,
          partnerCommission,
          netAmount,
        });

        // Asegurarse de que partnerId no sea null antes de crear el payout.
        if (booking.partnerId) {
          await prisma.payout.create({
            data: {
              paymentId: payment.id,
              partnerId: booking.partnerId,
              amount: serviceAmount,
              partnerCommission,
              partnerCommissionRate,
              netAmount,
              status: 'PENDING',
            },
          });
        } else {
          console.warn('No se creó payout: booking sin partnerId', { bookingId: booking.id, paymentId: payment.id });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error en webhook:', error);
    return NextResponse.json(
      { error: 'Error al procesar webhook' },
      { status: 500 }
    );
  }
}
    
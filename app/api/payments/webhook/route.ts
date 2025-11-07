import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import mercadopago from '@/lib/mercadopago';
import { createLogger } from '@/lib/logger';

const logger = createLogger('payments-webhook');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data } = body;

    if (type === 'payment') {
      const paymentId = data?.id;
      if (!paymentId) {
        logger.warn('Webhook payment received without id', { type });
        return NextResponse.json({ received: true });
      }

      const payment = await prisma.payment.findFirst({
        where: { mercadopagoId: String(paymentId) },
      });

      if (!payment) {
        logger.warn('Payment not found in database', { paymentId });
        return NextResponse.json({ received: true });
      }

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

        await prisma.notification.create({
          data: {
            userId: booking.userId,
            type: 'BOOKING_CONFIRMED',
            title: 'Pago recibido',
            message: `Tu pago de $${payment.totalAmount?.toLocaleString('es-CO') ?? payment.totalAmount} COP ha sido confirmado.`,
          },
        });

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

        let partnerCommissionRate: number;

        if (booking.partnerCommissionRate !== null && booking.partnerCommissionRate !== undefined) {
          partnerCommissionRate = Number(booking.partnerCommissionRate);
          logger.debug('Using saved partner commission rate from booking', {
            bookingId: booking.id,
            rateSource: 'booking'
          });
        } else {
          const config = await prisma.platformConfig.findFirst();
          if (!config) {
            logger.error('Platform configuration not found');
            return NextResponse.json({ received: true });
          }
          partnerCommissionRate = Number(config.partnerCommissionRate);
          logger.warn('Using current platform partner commission rate', {
            bookingId: booking.id,
            rateSource: 'platform'
          });
        }

        const serviceAmount = Number(payment.serviceAmount ?? payment.totalAmount ?? 0);
        const partnerCommission = (serviceAmount * partnerCommissionRate) / 100;
        const netAmount = serviceAmount - partnerCommission;

        logger.info('Creating payout for partner', {
          bookingId: booking.id,
          paymentId: payment.id,
          partnerCommissionRate,
        });

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
          logger.warn('Payout not created: booking without partnerId', {
            bookingId: booking.id,
            paymentId: payment.id
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('Error processing webhook', error);
    return NextResponse.json(
      { error: 'Error al procesar webhook' },
      { status: 500 }
    );
  }
}
    
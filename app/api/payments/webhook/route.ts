import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMercadoPagoClient } from '@/lib/mercadopago';
import { Payment } from 'mercadopago';
import { createLogger } from '@/lib/logger';
import { webhookRateLimiter } from '@/lib/rate-limit';
import crypto from 'crypto';
import { handleApiError } from '@/lib/errors';
import { env } from '@/lib/env';
import { createNotification } from '@/lib/notifications/notificationService';
import { systemTransition } from '@/lib/bookings/ops';
import { ensurePayoutForPayment } from '@/lib/payments/ops';
import { APP_ORIGIN, originColumns } from '@/lib/ops/origin';

const logger = createLogger('payments-webhook');

function verifyMercadoPagoSignature(req: NextRequest, body: string): boolean {
  const xSignature = req.headers.get('x-signature');
  const xRequestId = req.headers.get('x-request-id');

  if (!xSignature || !xRequestId) {
    logger.warn('Missing signature headers', { xSignature: !!xSignature, xRequestId: !!xRequestId });
    return false;
  }

  const secret = env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('MERCADOPAGO_WEBHOOK_SECRET not configured');
    return false;
  }

  try {
    const parts = xSignature.split(',');
    let ts: string | undefined;
    let hash: string | undefined;

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key && value) {
        const trimmedKey = key.trim();
        const trimmedValue = value.trim();
        if (trimmedKey === 'ts') {
          ts = trimmedValue;
        } else if (trimmedKey === 'v1') {
          hash = trimmedValue;
        }
      }
    }

    if (!ts || !hash) {
      logger.warn('Invalid signature format', { xSignature });
      return false;
    }

    const manifest = `id:${xRequestId};request-id:${xRequestId};ts:${ts};`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(manifest);
    const expectedHash = hmac.digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(expectedHash)
    );

    if (!isValid) {
      logger.warn('Invalid webhook signature', {
        xRequestId,
        expectedHash: expectedHash.substring(0, 10) + '...',
        receivedHash: hash.substring(0, 10) + '...'
      });
    }

    return isValid;
  } catch (error) {
    logger.error('Error verifying signature', error);
    return false;
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const bodyText = await req.text();

    if (!verifyMercadoPagoSignature(req, bodyText)) {
      logger.error('Invalid webhook signature - potential fraud attempt');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const body = JSON.parse(bodyText);
    const { type, data } = body;

    if (type === 'payment') {
      const paymentId = data?.id;
      if (!paymentId) {
        logger.warn('Webhook payment received without id', { type });
        return NextResponse.json({ received: true });
      }

      const { client: mercadopago } = await getMercadoPagoClient();
      const paymentClient = new Payment(mercadopago);
      const mpResponse = await paymentClient.get({ id: String(paymentId) });
      const mpPayment = mpResponse;
      const externalReference = (mpPayment as any)?.external_reference?.toString?.() || null;

      const payment = await prisma.payment.findFirst({
        where: {
          OR: [
            { mercadopagoId: String(paymentId) },
            ...(externalReference ? [{ bookingId: externalReference }] : []),
          ],
        },
      });

      if (!payment) {
        logger.warn('Payment not found in database', { paymentId, externalReference });
        return NextResponse.json({ received: true });
      }

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
        const booking = await prisma.booking.findUnique({
          where: { id: payment.bookingId },
          include: {
            user: true,
            partner: {
              include: {
                user: true,
              },
            },
          },
        });
        if (!booking) {
          logger.warn('Booking not found for approved payment', { paymentId: payment.id, bookingId: payment.bookingId });
          return NextResponse.json({ received: true });
        }

        // A paid booking only moves PENDING → CONFIRMED; one already in progress or completed keeps its state.
        if (booking.status === 'PENDING') {
          await systemTransition(booking.id, 'CONFIRMED', 'Pago aprobado por MercadoPago');
        }
        await prisma.bookingEvent.create({
          data: { bookingId: booking.id, type: 'payment', actorType: 'system', ...originColumns(APP_ORIGIN), detail: 'Pago aprobado por MercadoPago' },
        });

        await createNotification({
          userId: booking.userId,
          type: 'BOOKING_CONFIRMED',
          title: 'Pago recibido',
          message: `Tu pago de $${payment.totalAmount?.toLocaleString('es-CO') ?? payment.totalAmount} COP ha sido confirmado.`,
        });

        if (booking.partner?.user?.pushSubscription) {
          await createNotification({
            userId: booking.partner.user.id,
            type: 'BOOKING_CONFIRMED',
            title: 'Nueva reserva confirmada',
            message: `${booking.user?.name ?? 'Un cliente'} ha confirmado el pago. La reserva está lista.`,
          });
        }

        logger.info('Creating payout for partner', { bookingId: booking.id, paymentId: payment.id });
        await ensurePayoutForPayment(payment, booking);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return handleApiError(error, 'payments-webhook');
  }
}

export async function POST(req: NextRequest) {
  return webhookRateLimiter(req, handlePOST);
}
    

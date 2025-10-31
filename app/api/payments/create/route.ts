import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import mercadopago from '@/lib/mercadopago';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { bookingId } = await req.json();

    if (!bookingId) {
      return NextResponse.json(
        { error: 'bookingId es requerido' },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        partner: {
          include: {
            user: true,
          },
        },
        user: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Reserva no encontrada' },
        { status: 404 }
      );
    }

    if (booking.userId !== session.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const existingPayment = await prisma.payment.findUnique({
      where: { bookingId },
    });

    if (existingPayment && existingPayment.status === 'APPROVED') {
      return NextResponse.json(
        { error: 'Esta reserva ya ha sido pagada' },
        { status: 400 }
      );
    }

    let clientCommissionRate: number;

    if (booking.clientCommissionRate !== null && booking.clientCommissionRate !== undefined) {
      clientCommissionRate = Number(booking.clientCommissionRate);
      console.log('✅ Usando tarifa guardada en el booking:', clientCommissionRate);
    } else {
      const config = await prisma.platformConfig.findFirst();
      if (!config) {
        return NextResponse.json(
          { error: 'Configuración de la plataforma no encontrada' },
          { status: 500 }
        );
      }
      clientCommissionRate = Number(config.clientCommissionRate);
      console.log('⚠️ Usando tarifa actual de la plataforma:', clientCommissionRate);
    }

    const serviceAmount = booking.totalPrice;
    const clientCommission = (serviceAmount * clientCommissionRate) / 100;
    const totalAmount = serviceAmount + clientCommission;

    console.log('💰 Desglose del pago:', {
      serviceAmount,
      clientCommissionRate,
      clientCommission,
      totalAmount,
    });

    const preference = await mercadopago.preference.create({
      body: {
        items: [
          {
            id: bookingId,
            title: `Servicio: ${booking.service?.name}`,
            description: booking.service?.name || '',
            quantity: 1,
            unit_price: totalAmount,
            currency_id: 'COP',
          },
        ],
        payer: {
          name: booking.user?.name || '',
          email: booking.user?.email || '',
        },
        back_urls: {
          success: `${process.env.NEXT_PUBLIC_APP_URL}/bookings/${bookingId}?payment=success`,
          failure: `${process.env.NEXT_PUBLIC_APP_URL}/bookings/${bookingId}?payment=failure`,
          pending: `${process.env.NEXT_PUBLIC_APP_URL}/bookings/${bookingId}?payment=pending`,
        },
        auto_return: 'approved',
        notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/webhook`,
        external_reference: bookingId,
      },
    });

    if (existingPayment) {
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          preferenceId: preference.id,
          mercadopagoId: null,
          status: 'PENDING',
          amount: totalAmount,
          serviceAmount,
          clientCommission,
          clientCommissionRate,
          totalAmount,
        },
      });
    } else {
      await prisma.payment.create({
        data: {
          bookingId,
          userId: session.user.id,
          preferenceId: preference.id,
          status: 'PENDING',
          amount: totalAmount,
          serviceAmount,
          clientCommission,
          clientCommissionRate,
          totalAmount,
        },
      });
    }

    return NextResponse.json({
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
      breakdown: {
        serviceAmount,
        clientCommission,
        clientCommissionRate,
        totalAmount,
      },
    });
  } catch (error) {
    console.error('Error al crear pago:', error);
    return NextResponse.json(
      { error: 'Error al crear el pago' },
      { status: 500 }
    );
  }
}

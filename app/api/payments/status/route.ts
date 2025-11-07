import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger'


const logger = createLogger('payments-status')

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const bookingId = searchParams.get('bookingId');

    if (!bookingId) {
      return NextResponse.json(
        { error: 'bookingId es requerido' },
        { status: 400 }
      );
    }

    const payment = await prisma.payment.findUnique({
      where: { bookingId },
      include: {
        booking: {
          include: {
            service: true,
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(null);
    }

    if (
      payment.userId !== session.user.id &&
      session.user.role !== 'ADMIN'
    ) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    return NextResponse.json(payment);
  } catch (error) {
    logger.error('Error al obtener estado del pago:', error);
    return NextResponse.json(
      { error: 'Error al obtener estado del pago' },
      { status: 500 }
    );
  }
}

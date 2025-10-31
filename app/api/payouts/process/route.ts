import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { payoutId } = await req.json();

    if (!payoutId) {
      return NextResponse.json(
        { error: 'payoutId es requerido' },
        { status: 400 }
      );
    }

    const payout = await prisma.payout.findUnique({
      where: { id: payoutId },
      include: {
        payment: {
          include: {
            booking: {
              include: {
                service: true,
              },
            },
          },
        },
        partner: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!payout) {
      return NextResponse.json(
        { error: 'Pago no encontrado' },
        { status: 404 }
      );
    }

    if (payout.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Este pago ya ha sido procesado' },
        { status: 400 }
      );
    }

    const updatedPayout = await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'COMPLETED',
        processedAt: new Date(),
      },
    });

    await prisma.notification.create({
      data: {
        userId: payout.partner.user?.id ?? payout.partner.userId,
        type: 'BOOKING_CONFIRMED',
        title: 'Pago procesado',
        message: `Se ha procesado tu pago de $${payout.netAmount.toLocaleString('es-CO')} COP`,
      },
    });

    return NextResponse.json({
      success: true,
      payout: updatedPayout,
      breakdown: {
        amount: payout.amount,
        partnerCommission: payout.partnerCommission,
        partnerCommissionRate: payout.partnerCommissionRate,
        netAmount: payout.netAmount,
      },
    });
  } catch (error) {
    console.error('Error al procesar pago:', error);
    return NextResponse.json(
      { error: 'Error al procesar pago' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const partnerId = searchParams.get('partnerId');

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (partnerId) {
      where.partnerId = partnerId;
    }

    const payouts = await prisma.payout.findMany({
      where,
      include: {
        partner: {
          include: {
            user: true,
          },
        },
        payment: {
          include: {
            booking: {
              include: {
                service: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(payouts);
  } catch (error) {
    console.error('Error al obtener pagos pendientes:', error);
    return NextResponse.json(
      { error: 'Error al obtener pagos pendientes' },
      { status: 500 }
    );
  }
}

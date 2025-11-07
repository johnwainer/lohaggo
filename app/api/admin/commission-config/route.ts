import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';

const logger = createLogger('admin-commission-config');

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    let config = await prisma.platformConfig.findFirst();

    if (!config) {
      config = await prisma.platformConfig.create({
        data: {
          key: 'commission_rates',
          commissionRate: 15.0,
          clientCommissionRate: 5.0,
          partnerCommissionRate: 20.0,
          minServicePrice: 10000,
          maxServicePrice: 10000000,
        },
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    logger.error('Error fetching commission configuration', error);
    return NextResponse.json(
      { error: 'Error al obtener configuración' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { clientCommissionRate, partnerCommissionRate } = await req.json();

    if (
      typeof clientCommissionRate !== 'number' ||
      typeof partnerCommissionRate !== 'number'
    ) {
      return NextResponse.json(
        { error: 'Tasas de comisión inválidas' },
        { status: 400 }
      );
    }

    if (clientCommissionRate < 0 || clientCommissionRate > 50) {
      return NextResponse.json(
        { error: 'La comisión del cliente debe estar entre 0% y 50%' },
        { status: 400 }
      );
    }

    if (partnerCommissionRate < 0 || partnerCommissionRate > 50) {
      return NextResponse.json(
        { error: 'La comisión del socio debe estar entre 0% y 50%' },
        { status: 400 }
      );
    }

    const existingConfig = await prisma.platformConfig.findFirst();

    let config;
    if (existingConfig) {
      config = await prisma.platformConfig.update({
        where: { id: existingConfig.id },
        data: {
          clientCommissionRate,
          partnerCommissionRate,
          commissionRate: clientCommissionRate,
        },
      });
    } else {
      config = await prisma.platformConfig.create({
        data: {
          key: 'commission_rates',
          commissionRate: clientCommissionRate,
          clientCommissionRate,
          partnerCommissionRate,
          minServicePrice: 10000,
          maxServicePrice: 10000000,
        },
      });
    }

    logger.info('Commission configuration updated', {
      adminId: session.user.id,
      clientCommissionRate: config.clientCommissionRate,
      partnerCommissionRate: config.partnerCommissionRate,
    });

    return NextResponse.json(config);
  } catch (error) {
    logger.error('Error updating commission configuration', error);
    return NextResponse.json(
      { error: 'Error al actualizar configuración' },
      { status: 500 }
    );
  }
}

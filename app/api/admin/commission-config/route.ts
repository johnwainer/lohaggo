import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { commissionConfigSchema, validateRequest } from '@/lib/validation';
import { revalidateTag } from 'next/cache';
import { DEFAULT_COMMISSION, loadPlatformConfigRow } from '@/lib/payments/commission';
import { TRUST_CACHE_TAG } from '@/lib/public/trust';

const logger = createLogger('admin-commission-config');

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    let config = await loadPlatformConfigRow();

    if (!config) {
      config = await prisma.platformConfig.create({
        data: {
          key: 'commission_rates',
          commissionRate: DEFAULT_COMMISSION.clientCommissionRate,
          clientCommissionRate: DEFAULT_COMMISSION.clientCommissionRate,
          partnerCommissionRate: DEFAULT_COMMISSION.partnerCommissionRate,
          commissionEnabled: false,
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

    const body = await req.json();
    const validation = await validateRequest(commissionConfigSchema, body);

    if (!validation.success) {
      return validation.error;
    }

    const {
      clientCommissionRate,
      partnerCommissionRate,
      minServicePrice,
      maxServicePrice,
      commissionEnabled,
      cashEnabled,
      transferEnabled,
      mercadoPagoEnabled,
    } = validation.data;

    const existingConfig = await loadPlatformConfigRow();

    let config;
    if (existingConfig) {
      config = await prisma.platformConfig.update({
        where: { id: existingConfig.id },
        data: {
          clientCommissionRate,
          partnerCommissionRate,
          commissionRate: clientCommissionRate,
          ...(minServicePrice !== undefined ? { minServicePrice } : {}),
          ...(maxServicePrice !== undefined ? { maxServicePrice } : {}),
          ...(commissionEnabled !== undefined ? { commissionEnabled } : {}),
          ...(cashEnabled !== undefined ? { cashEnabled } : {}),
          ...(transferEnabled !== undefined ? { transferEnabled } : {}),
          ...(mercadoPagoEnabled !== undefined ? { mercadoPagoEnabled } : {}),
        },
      });
    } else {
      config = await prisma.platformConfig.create({
        data: {
          key: 'commission_rates',
          commissionRate: clientCommissionRate,
          clientCommissionRate,
          partnerCommissionRate,
          minServicePrice: minServicePrice ?? 10000,
          maxServicePrice: maxServicePrice ?? 10000000,
          commissionEnabled: commissionEnabled ?? false,
          cashEnabled: cashEnabled ?? true,
          transferEnabled: transferEnabled ?? true,
          mercadoPagoEnabled: mercadoPagoEnabled ?? false,
        },
      });
    }

    logger.info('Commission configuration updated', {
      adminId: session.user.id,
      clientCommissionRate: config.clientCommissionRate,
      partnerCommissionRate: config.partnerCommissionRate,
      commissionEnabled: config.commissionEnabled,
    });

    // Public pages promise «sin comisión» only while it is off: expire their cached facts right away.
    revalidateTag(TRUST_CACHE_TAG, { expire: 0 });

    return NextResponse.json(config);
  } catch (error) {
    logger.error('Error updating commission configuration', error);
    return NextResponse.json(
      { error: 'Error al actualizar configuración' },
      { status: 500 }
    );
  }
}

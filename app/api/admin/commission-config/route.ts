import { NextRequest, NextResponse } from 'next/server';
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { commissionConfigSchema, validateRequest } from '@/lib/validation';
import { revalidateTag } from 'next/cache';
import { DEFAULT_COMMISSION, loadPlatformConfigRow } from '@/lib/payments/commission';
import { TRUST_CACHE_TAG } from '@/lib/public/trust';

const logger = createLogger('admin-commission-config');

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
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
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!admin.isSuperAdmin) {
      return NextResponse.json({ error: 'Solo un superadmin puede cambiar esto' }, { status: 403 });
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

    if (minServicePrice !== undefined && maxServicePrice !== undefined && minServicePrice >= maxServicePrice) {
      return NextResponse.json(
        { error: 'El precio mínimo debe ser menor que el precio máximo' },
        { status: 400 }
      );
    }

    const existingConfig = await loadPlatformConfigRow();

    let config;
    if (existingConfig) {
      config = await prisma.platformConfig.update({
        where: { id: existingConfig.id },
        data: {
          ...(clientCommissionRate !== undefined ? { clientCommissionRate, commissionRate: clientCommissionRate } : {}),
          ...(partnerCommissionRate !== undefined ? { partnerCommissionRate } : {}),
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
          commissionRate: clientCommissionRate ?? DEFAULT_COMMISSION.clientCommissionRate,
          clientCommissionRate: clientCommissionRate ?? DEFAULT_COMMISSION.clientCommissionRate,
          partnerCommissionRate: partnerCommissionRate ?? DEFAULT_COMMISSION.partnerCommissionRate,
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
      adminId: admin.id,
      clientCommissionRate: config.clientCommissionRate,
      partnerCommissionRate: config.partnerCommissionRate,
      commissionEnabled: config.commissionEnabled,
    });

    await auditAdminAction({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'commission_config.update',
      entityType: 'PlatformConfig',
      entityId: config.id,
      route: '/api/admin/commission-config',
      details: JSON.stringify(validation.data),
      request: req,
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

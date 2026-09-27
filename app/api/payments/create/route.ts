import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import { paymentRateLimiter } from '@/lib/rate-limit';
import { currentActor, opsErrorResponse } from '@/lib/ops/actor';
import { APP_ORIGIN, OpsError } from '@/lib/ops/origin';
import { createMercadoPagoPreference } from '@/lib/payments/ops';

const logger = createLogger('payments-create');

async function handlePOST(req: NextRequest) {
  try {
    const actor = await currentActor();
    if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { bookingId } = await req.json();
    if (!bookingId || typeof bookingId !== 'string') {
      return NextResponse.json({ error: 'bookingId es requerido' }, { status: 400 });
    }

    const result = await createMercadoPagoPreference(actor, bookingId, APP_ORIGIN);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OpsError) return opsErrorResponse(error)
    logger.error('Error creating payment', { error });
    return NextResponse.json({ error: 'Error al crear el pago' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return paymentRateLimiter(req, handlePOST);
}

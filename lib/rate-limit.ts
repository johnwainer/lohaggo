import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from './logger';
import { clientIp, hit, memoryHit, unhit } from './rate-limit-store';

const logger = createLogger('rate-limit');

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  /** false: count in this instance's memory (high-frequency, low-risk routes: unread polling, webhooks) */
  shared?: boolean;
}

export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    max,
    message = 'Demasiadas solicitudes, por favor intente más tarde',
    skipSuccessfulRequests = false,
    shared = true,
  } = config;

  return async (
    req: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> => {
    // Shared across instances (Postgres); keyed by the client IP the platform reports and the route
    const ip = clientIp(req.headers);
    const key = `${ip}:${req.nextUrl.pathname}`;
    const now = Date.now();
    const h = shared ? await hit(key, windowMs, now) : memoryHit(key, windowMs, now);

    if (h.count > max) {
      logger.warn('Rate limit exceeded', {
        ip,
        path: req.nextUrl.pathname,
        count: h.count,
        max,
      });

      return NextResponse.json(
        { error: message },
        {
          status: 429,
          headers: {
            'Retry-After': Math.max(1, Math.ceil((h.resetAt - now) / 1000)).toString(),
            'X-RateLimit-Limit': max.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(h.resetAt).toISOString(),
          }
        }
      );
    }

    const response = await handler(req);

    let used = h.count;
    if (skipSuccessfulRequests && response.status < 400) {
      if (shared) await unhit(key, windowMs, now);
      used--;
    }

    response.headers.set('X-RateLimit-Limit', max.toString());
    response.headers.set('X-RateLimit-Remaining', Math.max(0, max - used).toString());
    response.headers.set('X-RateLimit-Reset', new Date(h.resetAt).toISOString());

    return response;
  };
}

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Demasiados intentos de inicio de sesión. Por favor, intente nuevamente en 15 minutos.',
  skipSuccessfulRequests: true,
});

export const registerRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Demasiados intentos de registro. Por favor, intente nuevamente en 1 hora.',
});

export const paymentRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Demasiadas solicitudes de pago. Por favor, espere un momento.',
});

export const webhookRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Demasiadas solicitudes de webhook.',
  shared: false,
});

export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Demasiadas solicitudes. Por favor, intente más tarde.',
  shared: false,
});

export const forgotPasswordRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Demasiadas solicitudes de recuperación. Por favor, intente nuevamente en 1 hora.',
});

export const adsTrackRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Demasiadas solicitudes.',
});

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from './logger';

const logger = createLogger('rate-limit');

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

function cleanupStore() {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}

setInterval(cleanupStore, 60000);

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}

export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    max,
    message = 'Demasiadas solicitudes, por favor intente más tarde',
    skipSuccessfulRequests = false,
  } = config;

  return async (
    req: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> => {
    const ip = req.headers.get('x-forwarded-for') || 
               req.headers.get('x-real-ip') || 
               'unknown';
    
    const key = `${ip}:${req.nextUrl.pathname}`;
    const now = Date.now();

    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    store[key].count++;

    if (store[key].count > max) {
      logger.warn('Rate limit exceeded', {
        ip,
        path: req.nextUrl.pathname,
        count: store[key].count,
        max,
      });

      return NextResponse.json(
        { error: message },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((store[key].resetTime - now) / 1000).toString(),
            'X-RateLimit-Limit': max.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(store[key].resetTime).toISOString(),
          }
        }
      );
    }

    const response = await handler(req);

    if (skipSuccessfulRequests && response.status < 400) {
      store[key].count--;
    }

    response.headers.set('X-RateLimit-Limit', max.toString());
    response.headers.set('X-RateLimit-Remaining', Math.max(0, max - store[key].count).toString());
    response.headers.set('X-RateLimit-Reset', new Date(store[key].resetTime).toISOString());

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
});

export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Demasiadas solicitudes. Por favor, intente más tarde.',
});

import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

export function validateMercadoPagoWebhook(
  request: NextRequest,
  body: string
): boolean {
  const xSignature = request.headers.get('x-signature')
  const xRequestId = request.headers.get('x-request-id')
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET

  if (!xSignature || !xRequestId || !secret) {
    return false
  }

  const parts = xSignature.split(',')
  let ts: string | undefined
  let hash: string | undefined

  parts.forEach(part => {
    const [key, value] = part.split('=')
    if (key && value) {
      const trimmedKey = key.trim()
      const trimmedValue = value.trim()
      if (trimmedKey === 'ts') {
        ts = trimmedValue
      } else if (trimmedKey === 'v1') {
        hash = trimmedValue
      }
    }
  })

  if (!ts || !hash) {
    return false
  }

  const manifest = `id:${xRequestId};request-id:${xRequestId};ts:${ts};`
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(manifest)
  const expectedHash = hmac.digest('hex')

  return hash === expectedHash
}

export function sanitizeLogData(data: any): any {
  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'apiKey',
    'api_key',
    'accessToken',
    'access_token',
    'authorization',
    'cookie',
    'session',
  ]

  if (typeof data !== 'object' || data === null) {
    return data
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeLogData(item))
  }

  const sanitized: any = {}
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase()
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64url')
}

export function hashPassword(password: string): Promise<string> {
  const bcrypt = require('bcryptjs')
  return bcrypt.hash(password, 12)
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = require('bcryptjs')
  return bcrypt.compare(password, hash)
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '')
    .substring(0, 1000)
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')

  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  if (realIp) {
    return realIp.trim()
  }

  return (request as any).ip || 'unknown'
}

export function createSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
  }
}

export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    'http://localhost:3000',
  ].filter(Boolean)

  if (!origin) {
    return true
  }

  return allowedOrigins.includes(origin)
}

export function createErrorResponse(
  message: string,
  status: number = 400,
  details?: any
): NextResponse {
  const response = {
    error: message,
    ...(details && !isProduction() ? { details } : {}),
  }

  return NextResponse.json(response, {
    status,
    headers: createSecurityHeaders()
  })
}

export function createSuccessResponse(
  data: any,
  status: number = 200
): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: createSecurityHeaders()
  })
}

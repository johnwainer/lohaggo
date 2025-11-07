import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function rateLimit(identifier: string, limit: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(identifier)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= limit) {
    return false
  }

  record.count++
  return true
}

export function validateContentType(request: NextRequest, expectedType: string = 'application/json'): boolean {
  const contentType = request.headers.get('content-type')
  return contentType?.includes(expectedType) ?? false
}

export function sanitizeQueryParams(searchParams: URLSearchParams): Record<string, string> {
  const sanitized: Record<string, string> = {}

  const entries = Array.from(searchParams.entries())
  for (const [key, value] of entries) {
    if (key.length > 100 || value.length > 1000) continue

    const cleanKey = key.replace(/[^\w-]/g, '')
    const cleanValue = value.replace(/[<>]/g, '')

    if (cleanKey && cleanValue) {
      sanitized[cleanKey] = cleanValue
    }
  }

  return sanitized
}

export function validatePagination(page?: string, limit?: string): { page: number; limit: number } {
  const pageNum = parseInt(page || '1', 10)
  const limitNum = parseInt(limit || '10', 10)
  
  return {
    page: isNaN(pageNum) || pageNum < 1 ? 1 : Math.min(pageNum, 1000),
    limit: isNaN(limitNum) || limitNum < 1 ? 10 : Math.min(limitNum, 100)
  }
}

export function createSecureHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
  }
}

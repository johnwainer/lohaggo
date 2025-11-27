os, rimport { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { env } from '@/lib/env'

const logger = createLogger('error-handler')

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string,
    public isOperational: boolean = true
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details?: any) {
    super(message, 400, 'VALIDATION_ERROR')
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'No autorizado') {
    super(message, 401, 'AUTHENTICATION_ERROR')
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'No tienes permisos para realizar esta acción') {
    super(message, 403, 'AUTHORIZATION_ERROR')
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Recurso no encontrado') {
    super(message, 404, 'NOT_FOUND_ERROR')
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR')
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Demasiadas solicitudes') {
    super(message, 429, 'RATE_LIMIT_ERROR')
  }
}

export function handleApiError(error: any, context?: string): NextResponse {
  const isProduction = env.NODE_ENV === 'production'

  if (error instanceof AppError) {
    logger.error(`${context || 'API'} error`, error, {
      code: error.code,
      statusCode: error.statusCode,
    })

    const response: any = {
      error: error.message,
      code: error.code,
    }

    if (error instanceof ValidationError && error.details) {
      response.details = error.details
    }

    return NextResponse.json(response, { status: error.statusCode })
  }

  logger.error(`${context || 'API'} unexpected error`, error)

  const message = isProduction
    ? 'Error interno del servidor'
    : error?.message || 'Error interno del servidor'

  const response: any = {
    error: message,
  }

  if (!isProduction && error?.stack) {
    response.stack = error.stack
  }

  return NextResponse.json(response, { status: 500 })
}

export function getErrorMessage(error: any): string {
  if (error instanceof AppError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'Error desconocido'
}

import pino from 'pino'

const sensitiveKeys = [
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'cardNumber',
  'card_number',
  'cvv',
  'securityCode',
  'security_code',
  'authorization',
  'cookie',
  'session',
]

const redactPaths = sensitiveKeys.flatMap(key => [
  key,
  `*.${key}`,
  `**.${key}`,
  `*.*.${key}`,
])

const isProduction = process.env.NODE_ENV === 'production'

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },
  transport: !isProduction
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label }
    },
  },
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
})

export function sanitizeForLog(data: any): any {
  if (!data) return data
  
  if (typeof data === 'string') {
    return data
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeForLog(item))
  }

  if (typeof data === 'object') {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase()
      if (sensitiveKeys.some(sk => lowerKey.includes(sk.toLowerCase()))) {
        sanitized[key] = '[REDACTED]'
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeForLog(value)
      } else {
        sanitized[key] = value
      }
    }
    return sanitized
  }

  return data
}

export function createLogger(context: string) {
  return {
    info: (message: string, data?: any) => {
      logger.info({ context, ...sanitizeForLog(data) }, message)
    },
    error: (message: string, error?: any, data?: any) => {
      logger.error(
        { 
          context, 
          err: error instanceof Error ? error : undefined,
          ...sanitizeForLog(data) 
        }, 
        message
      )
    },
    warn: (message: string, data?: any) => {
      logger.warn({ context, ...sanitizeForLog(data) }, message)
    },
    debug: (message: string, data?: any) => {
      if (!isProduction) {
        logger.debug({ context, ...sanitizeForLog(data) }, message)
      }
    },
  }
}

export default logger

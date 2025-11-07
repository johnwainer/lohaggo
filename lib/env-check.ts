import { createLogger } from './logger'

const logger = createLogger('env-check')

export function checkEnvVars() {
  const requiredVars = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
  ]

  const missingVars = requiredVars.filter(varName => !process.env[varName])

  if (missingVars.length > 0) {
    const availableVars = Object.keys(process.env).filter(key =>
      key.startsWith('DATABASE') ||
      key.startsWith('NEXTAUTH') ||
      key.startsWith('SUPABASE')
    )
    logger.error('Missing required environment variables', {
      missingVars,
      availableVarsCount: availableVars.length
    })
    return false
  }

  logger.info('All required environment variables are set')
  return true
}

if (process.env.NODE_ENV === 'development') {
  logger.debug('Environment check', {
    nodeEnv: process.env.NODE_ENV,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
  })
}

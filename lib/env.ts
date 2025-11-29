import { z } from 'zod'

const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'

const buildTimeSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL: z.string().optional(),
  POSTGRES_PRISMA_URL: z.string().optional(),

  NEXTAUTH_SECRET: z.string().optional(),
  NEXTAUTH_SECRET_CURRENT: z.string().optional(),
  NEXTAUTH_URL: z.string().optional(),

  SESSION_MAX_AGE: z.string().regex(/^\d+$/, 'SESSION_MAX_AGE must be a number').default('86400'),
  SESSION_UPDATE_AGE: z.string().regex(/^\d+$/, 'SESSION_UPDATE_AGE must be a number').default('3600'),

  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY: z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),

  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),

  NEXT_PUBLIC_APP_URL: z.string().optional(),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),

  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
})

const runtimeSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  POSTGRES_PRISMA_URL: z.string().optional(),

  NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET is required'),
  NEXTAUTH_SECRET_CURRENT: z.string().optional(),
  NEXTAUTH_URL: z.string().min(1, 'NEXTAUTH_URL is required'),

  SESSION_MAX_AGE: z.string().regex(/^\d+$/, 'SESSION_MAX_AGE must be a number').default('86400'),
  SESSION_UPDATE_AGE: z.string().regex(/^\d+$/, 'SESSION_UPDATE_AGE must be a number').default('3600'),

  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY: z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),

  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),

  NEXT_PUBLIC_APP_URL: z.string().optional(),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),

  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
})

type Env = z.infer<typeof runtimeSchema>

function validateEnv(): Env {
  if (isBuildTime) {
    console.log('⏭️  Skipping environment validation during build phase')
    return buildTimeSchema.parse(process.env) as Env
  }

  try {
    const parsed = runtimeSchema.parse(process.env)

    if (parsed.NODE_ENV === 'production') {
      if (parsed.NEXTAUTH_SECRET && parsed.NEXTAUTH_SECRET.length < 32) {
        throw new Error('NEXTAUTH_SECRET must be at least 32 characters')
      }

      if (parsed.NEXTAUTH_URL && !parsed.NEXTAUTH_URL.match(/^https?:\/\/.+/)) {
        throw new Error('NEXTAUTH_URL must be a valid URL')
      }

      if (!parsed.MERCADOPAGO_ACCESS_TOKEN) {
        console.warn('⚠️  MERCADOPAGO_ACCESS_TOKEN is not set in production')
      }
      if (!parsed.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY) {
        console.warn('⚠️  NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY is not set in production')
      }
      if (!parsed.MERCADOPAGO_WEBHOOK_SECRET) {
        console.warn('⚠️  MERCADOPAGO_WEBHOOK_SECRET is not set in production')
      }
      if (!parsed.NEXT_PUBLIC_APP_URL) {
        console.warn('⚠️  NEXT_PUBLIC_APP_URL is not set in production')
      }
      if (parsed.NEXT_PUBLIC_APP_URL && !parsed.NEXT_PUBLIC_APP_URL.startsWith('https://')) {
        console.warn('⚠️  NEXT_PUBLIC_APP_URL should use HTTPS in production')
      }
      if (parsed.NEXTAUTH_URL && !parsed.NEXTAUTH_URL.startsWith('https://')) {
        console.warn('⚠️  NEXTAUTH_URL should use HTTPS in production')
      }
    }

    if (parsed.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || parsed.CLOUDINARY_API_KEY || parsed.CLOUDINARY_API_SECRET) {
      if (!parsed.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || !parsed.CLOUDINARY_API_KEY || !parsed.CLOUDINARY_API_SECRET) {
        console.warn('⚠️  Cloudinary is partially configured. All three variables are required: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET')
      }
    }

    if (parsed.NEXT_PUBLIC_VAPID_PUBLIC_KEY || parsed.VAPID_PRIVATE_KEY) {
      if (!parsed.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !parsed.VAPID_PRIVATE_KEY) {
        console.warn('⚠️  VAPID keys are partially configured. Both NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are required for push notifications')
      }
    }

    if (parsed.NODE_ENV === 'development') {
      console.log('✅ Environment variables validated successfully')
    }

    return parsed
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('\n❌ Environment validation failed:\n')
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`)
      })
      console.error('\nPlease check your .env file and ensure all required variables are set.\n')
    } else {
      console.error('\n❌ Unexpected error during environment validation:', error)
    }

    process.exit(1)
  }
}

export const env = validateEnv()

export function getEnv<K extends keyof Env>(key: K): Env[K] {
  return env[key]
}

export function requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const value = env[key]
  if (value === undefined || value === null || value === '') {
    throw new Error(`Required environment variable ${key} is not set`)
  }
  return value as NonNullable<Env[K]>
}

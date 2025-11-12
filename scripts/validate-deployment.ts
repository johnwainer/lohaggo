import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL debe ser una URL válida'),

  NEXTAUTH_SECRET: z.string()
    .min(32, 'NEXTAUTH_SECRET debe tener al menos 32 caracteres')
    .regex(/^[A-Za-z0-9+/=]+$/, 'NEXTAUTH_SECRET debe ser base64 válido'),

  NEXTAUTH_URL: z.string()
    .url('NEXTAUTH_URL debe ser una URL válida')
    .refine(url => url.startsWith('https://') || process.env.NODE_ENV === 'development', {
      message: 'NEXTAUTH_URL debe usar HTTPS en producción'
    }),

  MERCADOPAGO_ACCESS_TOKEN: z.string()
    .min(20, 'MERCADOPAGO_ACCESS_TOKEN inválido')
    .startsWith('APP_USR-', 'MERCADOPAGO_ACCESS_TOKEN debe comenzar con APP_USR-'),

  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string()
    .min(1, 'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME es requerido'),

  CLOUDINARY_API_KEY: z.string()
    .min(1, 'CLOUDINARY_API_KEY es requerido'),

  CLOUDINARY_API_SECRET: z.string()
    .min(1, 'CLOUDINARY_API_SECRET es requerido'),

  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string()
    .min(1, 'NEXT_PUBLIC_VAPID_PUBLIC_KEY es requerido'),

  VAPID_PRIVATE_KEY: z.string()
    .min(1, 'VAPID_PRIVATE_KEY es requerido'),

  NEXT_PUBLIC_APP_URL: z.string()
    .url('NEXT_PUBLIC_APP_URL debe ser una URL válida')
    .refine(url => url.startsWith('https://') || process.env.NODE_ENV === 'development', {
      message: 'NEXT_PUBLIC_APP_URL debe usar HTTPS en producción'
    }),

  NODE_ENV: z.enum(['development', 'production', 'test']),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).optional().default('info'),

  SESSION_MAX_AGE: z.string().regex(/^\d+$/).optional().default('86400'),
  SESSION_UPDATE_AGE: z.string().regex(/^\d+$/).optional().default('3600'),

  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
})

const optionalEnvSchema = z.object({
  POSTGRES_PRISMA_URL: z.string().url().optional(),
  POSTGRES_URL_NON_POOLING: z.string().url().optional(),
  NEXTAUTH_SECRET_CURRENT: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  NEXT_PUBLIC_GA_ID: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
})

interface ValidationResult {
  success: boolean
  errors: string[]
  warnings: string[]
  info: string[]
}

function validateEnvironment(): ValidationResult {
  const result: ValidationResult = {
    success: true,
    errors: [],
    warnings: [],
    info: []
  }

  console.log('🔍 Validando variables de entorno...\n')

  try {
    envSchema.parse(process.env)
    result.info.push('✅ Todas las variables requeridas están configuradas correctamente')
  } catch (error) {
    result.success = false
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        result.errors.push(`❌ ${err.path.join('.')}: ${err.message}`)
      })
    }
  }

  try {
    optionalEnvSchema.parse(process.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        result.warnings.push(`⚠️  ${err.path.join('.')}: ${err.message}`)
      })
    }
  }

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.MERCADOPAGO_WEBHOOK_SECRET) {
      result.warnings.push('⚠️  MERCADOPAGO_WEBHOOK_SECRET no está configurado (recomendado para producción)')
    }

    if (!process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://')) {
      result.errors.push('❌ NEXT_PUBLIC_APP_URL debe usar HTTPS en producción')
      result.success = false
    }

    if (!process.env.NEXTAUTH_URL?.startsWith('https://')) {
      result.errors.push('❌ NEXTAUTH_URL debe usar HTTPS en producción')
      result.success = false
    }

    if (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length < 32) {
      result.errors.push('❌ NEXTAUTH_SECRET debe tener al menos 32 caracteres en producción')
      result.success = false
    }

    if (!process.env.UPSTASH_REDIS_REST_URL) {
      result.warnings.push('⚠️  UPSTASH_REDIS_REST_URL no configurado - rate limiting será en memoria (no recomendado para producción)')
    }

    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
      result.warnings.push('⚠️  NEXT_PUBLIC_SENTRY_DSN no configurado - no habrá tracking de errores')
    }
  }

  const sensitiveVars = [
    'NEXTAUTH_SECRET',
    'MERCADOPAGO_ACCESS_TOKEN',
    'CLOUDINARY_API_SECRET',
    'VAPID_PRIVATE_KEY',
    'DATABASE_URL'
  ]

  sensitiveVars.forEach(varName => {
    const value = process.env[varName]
    if (value && (value.includes('example') || value.includes('changeme') || value.includes('CAMBIAR'))) {
      result.errors.push(`❌ ${varName} parece contener un valor de ejemplo - debe ser reemplazado`)
      result.success = false
    }
  })

  if (process.env.DATABASE_URL?.includes('localhost') && process.env.NODE_ENV === 'production') {
    result.errors.push('❌ DATABASE_URL apunta a localhost en producción')
    result.success = false
  }

  return result
}

function checkDependencies(): ValidationResult {
  const result: ValidationResult = {
    success: true,
    errors: [],
    warnings: [],
    info: []
  }

  console.log('📦 Verificando dependencias...\n')

  try {
    const packageJson = require('../package.json')

    const criticalDeps = {
      'next': '14.2.0',
      'next-auth': '4.24.0',
      '@prisma/client': '5.22.0',
    }

    Object.entries(criticalDeps).forEach(([dep, minVersion]) => {
      const currentVersion = packageJson.dependencies[dep]
      if (!currentVersion) {
        result.errors.push(`❌ Dependencia crítica faltante: ${dep}`)
        result.success = false
      } else {
        result.info.push(`✅ ${dep}: ${currentVersion}`)
      }
    })

  } catch (error) {
    result.errors.push('❌ No se pudo leer package.json')
    result.success = false
  }

  return result
}

function checkSecurityConfig(): ValidationResult {
  const result: ValidationResult = {
    success: true,
    errors: [],
    warnings: [],
    info: []
  }

  console.log('🔒 Verificando configuración de seguridad...\n')

  try {
    const nextConfig = require('../next.config.js')

    if (!nextConfig.poweredByHeader || nextConfig.poweredByHeader !== false) {
      result.warnings.push('⚠️  poweredByHeader debería estar en false')
    } else {
      result.info.push('✅ poweredByHeader deshabilitado')
    }

    if (!nextConfig.reactStrictMode) {
      result.warnings.push('⚠️  reactStrictMode debería estar habilitado')
    } else {
      result.info.push('✅ reactStrictMode habilitado')
    }

    if (nextConfig.headers) {
      result.info.push('✅ Headers de seguridad configurados')
    } else {
      result.warnings.push('⚠️  No se encontraron headers de seguridad configurados')
    }

  } catch (error) {
    result.warnings.push('⚠️  No se pudo verificar next.config.js')
  }

  return result
}

function printResults(results: ValidationResult[]) {
  console.log('\n' + '='.repeat(60))
  console.log('📊 RESUMEN DE VALIDACIÓN')
  console.log('='.repeat(60) + '\n')

  const allErrors = results.flatMap(r => r.errors)
  const allWarnings = results.flatMap(r => r.warnings)
  const allInfo = results.flatMap(r => r.info)

  if (allInfo.length > 0) {
    console.log('ℹ️  INFORMACIÓN:\n')
    allInfo.forEach(info => console.log(`  ${info}`))
    console.log()
  }

  if (allWarnings.length > 0) {
    console.log('⚠️  ADVERTENCIAS:\n')
    allWarnings.forEach(warning => console.log(`  ${warning}`))
    console.log()
  }

  if (allErrors.length > 0) {
    console.log('❌ ERRORES:\n')
    allErrors.forEach(error => console.log(`  ${error}`))
    console.log()
  }

  const allSuccess = results.every(r => r.success)

  console.log('='.repeat(60))
  if (allSuccess) {
    console.log('✅ VALIDACIÓN EXITOSA - Listo para deployment')
  } else {
    console.log('❌ VALIDACIÓN FALLIDA - Corregir errores antes de deployment')
  }
  console.log('='.repeat(60) + '\n')

  return allSuccess
}

function main() {
  console.log('\n🚀 VALIDACIÓN PRE-DEPLOYMENT - HAGGO\n')
  console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`)
  console.log(`Fecha: ${new Date().toISOString()}\n`)

  const results = [
    validateEnvironment(),
    checkDependencies(),
    checkSecurityConfig(),
  ]

  const success = printResults(results)

  if (!success) {
    console.log('💡 RECOMENDACIONES:\n')
    console.log('  1. Revisa el archivo .env.production.example')
    console.log('  2. Genera secretos seguros con: openssl rand -base64 32')
    console.log('  3. Verifica la documentación en DEPLOYMENT_CHECKLIST.md')
    console.log('  4. Ejecuta npm audit para verificar vulnerabilidades\n')
    process.exit(1)
  }

  console.log('🎉 Todo listo para deployment!\n')
  process.exit(0)
}

main()

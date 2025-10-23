// Script para verificar las variables de entorno en Vercel
// Este archivo ayuda a debuggear problemas con las variables de entorno

export function checkEnvVars() {
  const requiredVars = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
  ]

  const missingVars = requiredVars.filter(varName => !process.env[varName])

  if (missingVars.length > 0) {
    console.error('❌ Missing environment variables:', missingVars)
    console.error('Available env vars:', Object.keys(process.env).filter(key => 
      key.startsWith('DATABASE') || 
      key.startsWith('NEXTAUTH') || 
      key.startsWith('SUPABASE')
    ))
    return false
  }

  console.log('✅ All required environment variables are set')
  return true
}

// Log en desarrollo
if (process.env.NODE_ENV === 'development') {
  console.log('Environment check:', {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL ? '✅ Set' : '❌ Missing',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? '✅ Set' : '❌ Missing',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ? '✅ Set' : '❌ Missing',
  })
}

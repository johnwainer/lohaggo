import { prisma } from '@/lib/prisma'

export const DEFAULT_OPERATIONAL_RULES = [
  {
    key: 'auth_session_429_spike',
    name: 'Spike 429 sesión',
    description: 'Detecta exceso de 429 en /api/auth/session en ventana corta',
    threshold: 20,
    windowMinutes: 5,
  },
  {
    key: 'login_failures_spike',
    name: 'Spike fallos login',
    description: 'Detecta picos de intentos de login fallidos',
    threshold: 10,
    windowMinutes: 5,
  },
  {
    key: 'api_errors_spike',
    name: 'Spike errores API',
    description: 'Detecta incremento de respuestas 5xx/errores operativos',
    threshold: 10,
    windowMinutes: 5,
  },
]

export async function ensureDefaultOperationalRules() {
  const current = await prisma.operationalRule.findMany({
    select: { key: true },
  })
  const currentKeys = new Set(current.map((r) => r.key))

  const missing = DEFAULT_OPERATIONAL_RULES.filter((r) => !currentKeys.has(r.key))
  if (missing.length === 0) return

  await prisma.operationalRule.createMany({
    data: missing.map((rule) => ({
      ...rule,
      enabled: true,
      metadata: null,
    })),
  })
}


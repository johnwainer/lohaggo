import { prisma } from '@/lib/prisma'
import { trustReport } from '@/lib/public/trust'
import { loadPlatformConfigRow } from '@/lib/payments/commission'
import { configStatusText, type ConfigStatus } from '@/lib/haggo/platform-facts'

/** The live configuration Haggo must keep in mind (commissions, payment methods, cities, claims). */
export async function loadConfigStatus(): Promise<ConfigStatus> {
  const [row, cities, trust] = await Promise.all([
    loadPlatformConfigRow().catch(() => null),
    prisma.cityConfig.findMany({ where: { status: { in: ['ACTIVE', 'COMING_SOON'] } }, orderBy: { order: 'asc' }, select: { name: true, status: true } }).catch(() => []),
    trustReport().catch(() => null),
  ])
  return {
    commission: row ? { enabled: row.commissionEnabled, clientRate: row.clientCommissionRate, partnerRate: row.partnerCommissionRate } : null,
    payments: row ? { cash: row.cashEnabled, transfer: row.transferEnabled, mercadoPago: row.mercadoPagoEnabled } : null,
    cities: { active: cities.filter((c) => c.status === 'ACTIVE').map((c) => c.name), comingSoon: cities.filter((c) => c.status === 'COMING_SOON').map((c) => c.name) },
    claimsOn: trust ? Object.entries(trust.claims).filter(([, on]) => on).map(([k]) => k) : [],
    unbacked: trust?.unbacked ?? [],
  }
}

/** Never blocks a cycle: on error the block says so. */
export async function configStatusBlock() {
  try {
    return configStatusText(await loadConfigStatus())
  } catch {
    return 'Estado de configuración: no se pudo leer ahora (usa configuracion_plataforma).'
  }
}

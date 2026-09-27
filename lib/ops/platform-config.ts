import { revalidateTag } from 'next/cache'
import type { CityStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CLAIMS, isClaimKey, type ClaimKey } from '@/lib/public/claims'
import { getClaimState, TRUST_CACHE_TAG } from '@/lib/public/trust'
import { loadPlatformConfigRow } from '@/lib/payments/commission'
import { TOOL_NAMES } from '@/lib/ai/tools'
import { PlatformOpsError } from '@/lib/ops/platform-ops'

/**
 * Platform configuration shared by admin routes and Haggo: public claims, commissions, cities and the
 * tools of inbox agents. No permission checks nor audit here: the caller does both.
 */

export const COMMISSION_MAX_RATE = 30
export const CITY_STATUSES: CityStatus[] = ['ACTIVE', 'COMING_SOON', 'INACTIVE']

/** Outside a request (a script) there is no cache to revalidate: never fail the change for it. */
function revalidateTrust() {
  try {
    revalidateTag(TRUST_CACHE_TAG, { expire: 0 })
  } catch {
    /* no request context */
  }
}

export async function setClaim(key: ClaimKey, enabled: boolean) {
  if (!isClaimKey(key)) throw new PlatformOpsError('Afirmación desconocida')
  // Creates the missing claim rows with their defaults first
  const state = await getClaimState()
  const previous = state[key]
  if (previous !== enabled) {
    await prisma.featureFlag.upsert({
      where: { key },
      update: { enabled },
      create: { key, name: CLAIMS[key].name, description: `${CLAIMS[key].says} Requiere: ${CLAIMS[key].requires}`, enabled },
    })
  }
  revalidateTrust()
  return { previous }
}

export type CommissionPatch = { enabled?: boolean; clientRate?: number; partnerRate?: number }
export type CommissionState = { enabled: boolean; clientRate: number; partnerRate: number }

export function validRate(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= COMMISSION_MAX_RATE
}

export async function getCommission(): Promise<CommissionState | null> {
  const c = await loadPlatformConfigRow()
  return c ? { enabled: c.commissionEnabled, clientRate: c.clientCommissionRate, partnerRate: c.partnerCommissionRate } : null
}

/** Turns commissions on or off and/or changes the rates (percent, 0..30). */
export async function setCommission(patch: CommissionPatch) {
  if (patch.clientRate !== undefined && !validRate(patch.clientRate)) throw new PlatformOpsError(`La comisión del cliente debe estar entre 0 y ${COMMISSION_MAX_RATE} %`)
  if (patch.partnerRate !== undefined && !validRate(patch.partnerRate)) throw new PlatformOpsError(`La comisión del socio debe estar entre 0 y ${COMMISSION_MAX_RATE} %`)
  const row = await loadPlatformConfigRow()
  if (!row) throw new PlatformOpsError('No hay configuración de pagos')
  const previous: CommissionState = { enabled: row.commissionEnabled, clientRate: row.clientCommissionRate, partnerRate: row.partnerCommissionRate }
  await prisma.platformConfig.update({
    where: { id: row.id },
    data: {
      ...(patch.enabled !== undefined ? { commissionEnabled: patch.enabled } : {}),
      ...(patch.clientRate !== undefined ? { clientCommissionRate: patch.clientRate, commissionRate: patch.clientRate } : {}),
      ...(patch.partnerRate !== undefined ? { partnerCommissionRate: patch.partnerRate } : {}),
    },
  })
  revalidateTrust()
  return { previous }
}

export async function setCityStatus(slug: string, status: CityStatus) {
  if (!CITY_STATUSES.includes(status)) throw new PlatformOpsError('Estado de ciudad inválido')
  const city = await prisma.cityConfig.findUnique({ where: { slug }, select: { id: true, status: true } })
  if (!city) throw new PlatformOpsError('Ciudad no encontrada')
  if (city.status !== status) await prisma.cityConfig.update({ where: { id: city.id }, data: { status } })
  revalidateTrust()
  return { previous: city.status }
}

/** Adds and removes tools of an inbox agent, only names of the catalog. Returns the previous list. */
export async function setAgentTools(agentId: string, change: { add?: string[]; remove?: string[] }) {
  const known = new Set<string>(TOOL_NAMES)
  const bad = [...(change.add ?? []), ...(change.remove ?? [])].filter((t) => !known.has(t))
  if (bad.length) throw new PlatformOpsError(`Herramientas desconocidas: ${bad.join(', ')}`)
  const agent = await prisma.aiAgent.findUnique({ where: { id: agentId }, select: { tools: true } })
  if (!agent) throw new PlatformOpsError('Agente no encontrado')
  const remove = new Set(change.remove ?? [])
  const next = Array.from(new Set([...agent.tools.filter((t) => !remove.has(t)), ...(change.add ?? [])]))
  // Catalog order: stable prompts (cacheable prefix)
  const ordered = [...TOOL_NAMES.filter((t) => next.includes(t)), ...next.filter((t) => !known.has(t))]
  await prisma.aiAgent.update({ where: { id: agentId }, data: { tools: ordered } })
  return { previous: agent.tools, tools: ordered }
}

/** Replaces the whole tool list (used by undo). */
export async function restoreAgentTools(agentId: string, tools: string[]) {
  await prisma.aiAgent.update({ where: { id: agentId }, data: { tools } })
}

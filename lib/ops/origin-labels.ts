import { prisma } from '@/lib/prisma'

/** Resolves `originAgentId` → `AiAgent.name` for a list of origin-aware rows (one query for the unique ids). */
export async function attachAgentNames<T extends { originAgentId: string | null }>(
  rows: T[]
): Promise<(T & { originAgentName: string | null })[]> {
  const ids = Array.from(new Set(rows.map((r) => r.originAgentId).filter((id): id is string => Boolean(id))))
  const names = new Map<string, string>()
  if (ids.length) {
    const agents = await prisma.aiAgent.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    for (const a of agents) names.set(a.id, a.name)
  }
  return rows.map((r) => ({ ...r, originAgentName: r.originAgentId ? names.get(r.originAgentId) ?? null : null }))
}

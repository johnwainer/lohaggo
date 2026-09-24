import { prisma } from '@/lib/prisma'
import type { AdminIdentity } from '@/lib/workspaces'

export const AI_PERMISSIONS = {
  view: 'ai.view',
  edit: 'ai.edit',
  knowledge: 'ai.knowledge',
  test: 'ai.test',
} as const

export type AiPermission = (typeof AI_PERMISSIONS)[keyof typeof AI_PERMISSIONS]

export const AI_PERMISSION_LABELS: Record<AiPermission, string> = {
  'ai.view': 'Ver agentes',
  'ai.edit': 'Editar agentes',
  'ai.knowledge': 'Editar conocimiento',
  'ai.test': 'Probar agentes (consume saldo)',
}

const ALL = Object.values(AI_PERMISSIONS) as AiPermission[]

export type AiAccess = {
  isSuperAdmin: boolean
  /** workspaceId → granted permissions */
  grants: Record<string, AiPermission[]>
  owners: string[]
}

/**
 * Superadmin: everything, every workspace (and the platform settings: keys, prices, caps).
 * Workspace OWNER: every AI permission in that workspace.
 * MEMBER: only what the owner granted in WorkspaceMember.permissions (edit/knowledge/test imply view).
 */
export function resolveGrants(role: 'OWNER' | 'MEMBER', granted: string[]): AiPermission[] {
  if (role === 'OWNER') return ALL
  const set = ALL.filter((p) => granted.includes(p))
  if (set.length && !set.includes('ai.view')) set.unshift('ai.view')
  return set
}

export async function getAiAccess(admin: AdminIdentity): Promise<AiAccess> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: admin.id },
    select: { workspaceId: true, role: true, permissions: true },
  })
  const grants: Record<string, AiPermission[]> = {}
  for (const m of memberships) grants[m.workspaceId] = resolveGrants(m.role, m.permissions)
  const owners = memberships.filter((m) => m.role === 'OWNER').map((m) => m.workspaceId)
  return { isSuperAdmin: Boolean(admin.isSuperAdmin), grants, owners }
}

/** Who can grant AI permissions to a workspace's members: its owner or the platform administrator. */
export function canManageAiPermissions(access: AiAccess, workspaceId: string) {
  return access.isSuperAdmin || access.owners.includes(workspaceId)
}

export function aiCan(access: AiAccess, workspaceId: string, perm: AiPermission) {
  if (access.isSuperAdmin) return true
  return access.grants[workspaceId]?.includes(perm) ?? false
}

/** null = all workspaces */
export function aiWorkspacesWith(access: AiAccess, perm: AiPermission): string[] | null {
  if (access.isSuperAdmin) return null
  return Object.keys(access.grants).filter((id) => access.grants[id].includes(perm))
}

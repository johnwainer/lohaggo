import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'

/**
 * Marketing permissions per workspace, stored with the other grants in WorkspaceMember.permissions.
 * Superadmin: everything. Workspace OWNER: everything in it. MEMBER: what the owner granted
 * (edit and publish imply view; publish is separate so someone can write without publishing).
 */
export const MARKETING_PERMISSION_LABELS = {
  'marketing.view': 'Ver publicaciones, campañas y estadísticas',
  'marketing.edit': 'Crear y editar publicaciones y campañas',
  'marketing.publish': 'Publicar y programar',
} as const

export type MarketingPermission = keyof typeof MARKETING_PERMISSION_LABELS
const ALL = Object.keys(MARKETING_PERMISSION_LABELS) as MarketingPermission[]

export function resolveMarketingGrants(role: 'OWNER' | 'MEMBER', granted: string[]): MarketingPermission[] {
  if (role === 'OWNER') return ALL
  const set = ALL.filter((p) => granted.includes(p))
  if (set.length && !set.includes('marketing.view')) set.unshift('marketing.view')
  return set
}

export type MarketingAccess = { isSuperAdmin: boolean; grants: Record<string, MarketingPermission[]>; owners: string[] }

type Admin = NonNullable<Awaited<ReturnType<typeof requireAdmin>>>
export type MarketingAuth = { ok: true; admin: Admin; access: MarketingAccess } | { ok: false; response: NextResponse }

export async function marketingAuth(): Promise<MarketingAuth> {
  const admin = await requireAdmin()
  if (!admin) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const memberships = await prisma.workspaceMember.findMany({ where: { userId: admin.id }, select: { workspaceId: true, role: true, permissions: true } })
  const grants: Record<string, MarketingPermission[]> = {}
  for (const m of memberships) grants[m.workspaceId] = resolveMarketingGrants(m.role, m.permissions)
  return { ok: true, admin, access: { isSuperAdmin: Boolean(admin.isSuperAdmin), grants, owners: memberships.filter((m) => m.role === 'OWNER').map((m) => m.workspaceId) } }
}

export function mkCan(access: MarketingAccess, workspaceId: string, perm: MarketingPermission) {
  return access.isSuperAdmin || (access.grants[workspaceId]?.includes(perm) ?? false)
}

/** null = every workspace */
export function mkWorkspacesWith(access: MarketingAccess, perm: MarketingPermission): string[] | null {
  if (access.isSuperAdmin) return null
  return Object.keys(access.grants).filter((id) => access.grants[id].includes(perm))
}

export function canManageMarketingPermissions(access: MarketingAccess, workspaceId: string) {
  return access.isSuperAdmin || access.owners.includes(workspaceId)
}

export function forbidden(message = 'No tienes permiso para esta acción') {
  return NextResponse.json({ error: message }, { status: 403 })
}

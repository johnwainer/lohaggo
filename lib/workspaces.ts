import type { WorkspaceRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const DEFAULT_WORKSPACE_NAME = 'LoHaggo'

export type AdminIdentity = { id: string; email: string; isSuperAdmin?: boolean }

export type WorkspaceAccess = {
  isSuperAdmin: boolean
  /** null = every workspace (superadmin) */
  workspaceIds: string[] | null
  roles: Map<string, WorkspaceRole>
}

/** The platform-level workspace that receives Twilio (SMS/WhatsApp) conversations. Created on demand. */
export async function getDefaultWorkspace() {
  const existing = await prisma.workspace.findFirst({ where: { isDefault: true }, orderBy: { createdAt: 'asc' } })
  if (existing) return existing
  return prisma.workspace.create({ data: { name: DEFAULT_WORKSPACE_NAME, isDefault: true } })
}

let cachedDefaultId: string | null = null
export async function getDefaultWorkspaceId() {
  if (cachedDefaultId) return cachedDefaultId
  const ws = await getDefaultWorkspace()
  cachedDefaultId = ws.id
  return ws.id
}

export async function getWorkspaceAccess(admin: AdminIdentity): Promise<WorkspaceAccess> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: admin.id },
    select: { workspaceId: true, role: true },
  })
  const roles = new Map(memberships.map((m) => [m.workspaceId, m.role]))
  const isSuperAdmin = Boolean(admin.isSuperAdmin)
  return { isSuperAdmin, workspaceIds: isSuperAdmin ? null : Array.from(roles.keys()), roles }
}

export function canView(access: WorkspaceAccess, workspaceId: string) {
  return access.isSuperAdmin || access.roles.has(workspaceId)
}

export function canManage(access: WorkspaceAccess, workspaceId: string) {
  return access.isSuperAdmin || access.roles.get(workspaceId) === 'OWNER'
}

/** Prisma `where` fragment restricting a query to the workspaces the admin can see. */
export function workspaceScope(access: WorkspaceAccess) {
  return access.workspaceIds === null ? {} : { workspaceId: { in: access.workspaceIds } }
}

export async function listAccessibleWorkspaces(access: WorkspaceAccess) {
  return prisma.workspace.findMany({
    where: access.workspaceIds === null ? {} : { id: { in: access.workspaceIds } },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, isDefault: true },
  })
}

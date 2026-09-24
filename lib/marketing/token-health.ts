import type { ChannelConnection, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { encryptConfig } from '@/lib/secure-config'
import { debugToken, exchangeLongLivedToken, listPagesForChannel, pageTokenFrom } from '@/lib/messaging/meta-graph'
import { describeGraphError, getConnectionCredentials, getConnectionMeta, isMetaChannel, requireMetaApp, type ConnectionCredentials } from '@/lib/messaging/meta-channels'
import type { MetaAppConfig } from '@/lib/messaging/provider-config'

const logger = createLogger('token-health')

/** Renew the person's user token when it has less than this left (Meta lets you extend it while valid). */
export const RENEW_BEFORE_MS = 15 * 24 * 3600_000

export type TokenHealth = {
  valid: boolean
  checkedAt: string
  kind: 'oauth_user' | 'system_user' | 'unknown'
  pageTokenExpiresAt: string | null
  userTokenExpiresAt: string | null
  renewedAt?: string | null
  error: string | null
}

const SUBCODE_REASON: Record<number, string> = {
  458: 'La app fue desinstalada de la cuenta',
  460: 'Cambió la contraseña de la cuenta que conectó la página',
  463: 'El token expiró',
  467: 'El token no es válido',
  492: 'La persona que conectó la página ya no tiene rol en ella',
}

/** Pure: whether the user token should be renewed now. */
export function shouldRenew(userTokenExpiresAt: Date | null, now: Date) {
  return Boolean(userTokenExpiresAt) && userTokenExpiresAt!.getTime() - now.getTime() < RENEW_BEFORE_MS && userTokenExpiresAt!.getTime() > now.getTime()
}

async function saveHealth(conn: ChannelConnection, health: TokenHealth, extra: Prisma.ChannelConnectionUpdateInput = {}) {
  const caps = ((conn.capabilities as Record<string, unknown> | null) || {}) as Record<string, unknown>
  await prisma.channelConnection.update({
    where: { id: conn.id },
    data: {
      capabilities: { ...caps, tokenHealth: health } as Prisma.InputJsonValue,
      ...(health.valid ? (conn.status === 'ERROR' && /token|contraseña|rol/i.test(conn.lastError || '') ? { status: 'ACTIVE', lastError: null } : {}) : { status: 'ERROR', lastError: health.error }),
      ...extra,
    },
  })
}

/** Re-derives the page token from the stored user (or system-user) token. */
async function rederive(app: MetaAppConfig, conn: ChannelConnection, creds: ConnectionCredentials, userToken: string) {
  const meta = getConnectionMeta(conn)
  if (conn.channel === 'MESSENGER' || meta.pageId) return pageTokenFrom(app, userToken, meta.pageId || conn.externalId)
  const pages = await listPagesForChannel(app, userToken, 'INSTAGRAM')
  const match = pages.find((p) => p.id === conn.externalId)
  if (!match) throw new Error('La cuenta que conectó ya no administra esta página')
  return match.pageAccessToken || creds.pageAccessToken
}

/**
 * One connection: check the page token; renew the person's user token before it expires and derive a
 * fresh page token from it; a system-user token re-derives the page token if it stopped working.
 */
export async function checkConnectionToken(conn: ChannelConnection, now = new Date()): Promise<TokenHealth> {
  const app = await requireMetaApp()
  const creds = getConnectionCredentials(conn)
  const meta = getConnectionMeta(conn)
  const kind: TokenHealth['kind'] = creds?.systemUserToken ? 'system_user' : creds?.userAccessToken ? 'oauth_user' : 'unknown'
  const base: TokenHealth = { valid: false, checkedAt: now.toISOString(), kind, pageTokenExpiresAt: null, userTokenExpiresAt: null, error: null }
  if (!creds?.pageAccessToken) {
    const h = { ...base, error: 'No hay token guardado: reconecta la cuenta' }
    await saveHealth(conn, h)
    return h
  }

  let nextCreds: ConnectionCredentials = { ...creds }
  let renewedAt: string | null = null
  try {
    // 1. Person's user token close to expiry → exchange for a new 60-day one, derive a new page token
    if (creds.userAccessToken) {
      const user = await debugToken(app, creds.userAccessToken).catch(() => null)
      base.userTokenExpiresAt = user?.neverExpires ? null : user?.expiresAt?.toISOString() ?? null
      if (user?.valid && shouldRenew(user.expiresAt, now)) {
        const renewed = await exchangeLongLivedToken(app, creds.userAccessToken)
        const pageAccessToken = await rederive(app, conn, creds, renewed.token)
        nextCreds = { ...nextCreds, userAccessToken: renewed.token, pageAccessToken }
        renewedAt = now.toISOString()
        base.userTokenExpiresAt = renewed.expiresIn ? new Date(now.getTime() + renewed.expiresIn * 1000).toISOString() : null
      }
    }

    // 2. The page token itself
    let page = await debugToken(app, nextCreds.pageAccessToken)
    if (!page.valid && (nextCreds.systemUserToken || nextCreds.userAccessToken)) {
      // Invalidated page token but the source token still works: derive a new one
      const source = nextCreds.systemUserToken || nextCreds.userAccessToken!
      const sourceDebug = await debugToken(app, source).catch(() => null)
      if (sourceDebug?.valid) {
        nextCreds.pageAccessToken = await rederive(app, conn, nextCreds, source)
        renewedAt = now.toISOString()
        page = await debugToken(app, nextCreds.pageAccessToken)
      }
    }

    const health: TokenHealth = {
      ...base,
      valid: page.valid,
      pageTokenExpiresAt: page.neverExpires ? null : page.expiresAt?.toISOString() ?? null,
      renewedAt,
      error: page.valid ? null : `${(page.errorSubcode && SUBCODE_REASON[page.errorSubcode]) || page.error || 'El token no es válido'}: reconecta la cuenta en Admin → Canales`,
    }
    const changed = nextCreds.pageAccessToken !== creds.pageAccessToken || nextCreds.userAccessToken !== creds.userAccessToken
    await saveHealth(conn, health, changed
      ? { credentialsEncrypted: encryptConfig(nextCreds), meta: { ...meta, tokenExpiresAt: health.userTokenExpiresAt } as unknown as Prisma.InputJsonValue }
      : {})
    return health
  } catch (err) {
    // Could not check (network, Meta down): keep the last known state, only note the attempt
    logger.warn('Token check failed', { connectionId: conn.id, err: describeGraphError(err) })
    const prev = (conn.capabilities as { tokenHealth?: TokenHealth } | null)?.tokenHealth
    return prev ?? { ...base, valid: true, error: null }
  }
}

/** Daily cron over every Messenger / Instagram connection. */
export async function runTokenHealth() {
  const conns = await prisma.channelConnection.findMany({ where: { channel: { in: ['MESSENGER', 'INSTAGRAM'] } } })
  let invalid = 0
  let renewed = 0
  for (const conn of conns) {
    if (!isMetaChannel(conn.channel)) continue
    const h = await checkConnectionToken(conn)
    if (!h.valid) invalid++
    if (h.renewedAt) renewed++
  }
  return { checked: conns.length, invalid, renewed }
}

/**
 * Business Manager system-user token for accounts the business owns: permanent, independent of any
 * person's password. The page token is derived from it and re-derived if Meta invalidates it.
 */
export async function setSystemUserToken(connectionId: string, systemToken: string) {
  const conn = await prisma.channelConnection.findUnique({ where: { id: connectionId } })
  if (!conn || !isMetaChannel(conn.channel)) throw new Error('Conexión no encontrada')
  const app = await requireMetaApp()
  const d = await debugToken(app, systemToken)
  if (!d.valid) throw new Error(`El token no es válido${d.error ? `: ${d.error}` : ''}`)
  if (d.type && d.type !== 'USER' && d.type !== 'SYSTEM_USER') throw new Error('Pega el token del usuario del sistema, no un token de página ni de app')
  const creds = getConnectionCredentials(conn) || { pageAccessToken: '' }
  let pageAccessToken: string
  try {
    pageAccessToken = await rederive(app, conn, creds, systemToken)
  } catch (err) {
    throw new Error(`El usuario del sistema no tiene acceso a esta página: ${describeGraphError(err)}`)
  }
  const meta = getConnectionMeta(conn)
  const next: ConnectionCredentials = { pageAccessToken, systemUserToken: systemToken }
  await prisma.channelConnection.update({
    where: { id: conn.id },
    data: { credentialsEncrypted: encryptConfig(next), meta: { ...meta, tokenKind: 'system_user', tokenExpiresAt: null } as unknown as Prisma.InputJsonValue },
  })
  const fresh = await prisma.channelConnection.findUniqueOrThrow({ where: { id: conn.id } })
  return checkConnectionToken(fresh)
}

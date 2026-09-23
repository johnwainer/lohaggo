import { randomBytes } from 'crypto'
import type { ChannelConnection, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { createLogger } from '@/lib/logger'
import { decryptConfig, encryptConfig } from '@/lib/secure-config'
import { getMetaAppConfig, type MetaAppConfig } from '@/lib/messaging/provider-config'
import {
  buildOAuthUrl,
  exchangeCodeForUserToken,
  exchangeLongLivedToken,
  isPageSubscribed,
  listPagesForChannel,
  MetaGraphError,
  probeSendCapability,
  subscribePageWithFallback,
  type MetaChannel,
  type MetaPageCandidate,
} from '@/lib/messaging/meta-graph'

const logger = createLogger('meta-channels')

export const OAUTH_SESSION_TTL_MS = 10 * 60 * 1000

export type ConnectionCredentials = { pageAccessToken: string }
export type ConnectionMeta = {
  pageId: string
  username?: string | null
  scopes?: string[]
  subscribedFields?: string[]
  tokenExpiresAt?: string | null
}
export type ConnectionCapabilities = {
  receive: boolean
  send: boolean
  sendDetail?: string
  receiveDetail?: string
  checkedAt: string
}

export function isMetaChannel(channel: string): channel is MetaChannel {
  return channel === 'MESSENGER' || channel === 'INSTAGRAM'
}

export function getAppBaseUrl() {
  const base = env.NEXT_PUBLIC_APP_URL || env.NEXTAUTH_URL || ''
  return base.replace(/\/+$/, '')
}

export function getOAuthRedirectUri() {
  return `${getAppBaseUrl()}/api/channels/oauth/callback`
}

export function getWebhookUrls() {
  const base = getAppBaseUrl()
  return {
    messenger: `${base}/api/channels/messenger/webhook`,
    instagram: `${base}/api/channels/instagram/webhook`,
  }
}

export async function requireMetaApp(): Promise<MetaAppConfig> {
  const app = await getMetaAppConfig()
  if (!app?.appId || !app.appSecret) {
    throw new Error('La App de Meta no está configurada (appId / appSecret)')
  }
  return app
}

export function getConnectionCredentials(conn: Pick<ChannelConnection, 'credentialsEncrypted'>): ConnectionCredentials | null {
  try {
    return decryptConfig<ConnectionCredentials>(conn.credentialsEncrypted)
  } catch {
    return null
  }
}

export function getConnectionMeta(conn: Pick<ChannelConnection, 'meta'>): ConnectionMeta {
  return ((conn.meta as ConnectionMeta | null) || { pageId: '' }) as ConnectionMeta
}

// ─── OAuth sessions ──────────────────────────────────────────────────────────

export async function startOAuthSession(params: { channel: MetaChannel; adminId: string }) {
  const app = await requireMetaApp()
  await prisma.channelOAuthSession.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => null)

  const state = randomBytes(24).toString('hex')
  const session = await prisma.channelOAuthSession.create({
    data: {
      state,
      channel: params.channel,
      adminId: params.adminId,
      status: 'pending',
      expiresAt: new Date(Date.now() + OAUTH_SESSION_TTL_MS),
    },
  })

  const url = buildOAuthUrl({ app, redirectUri: getOAuthRedirectUri(), state, channel: params.channel })
  return { session, url }
}

export type OAuthCallbackResult =
  | { ok: true; sessionId: string }
  | { ok: false; sessionId: string | null; error: string }

/**
 * Public callback: trusts only `state`. Exchanges the code, upgrades to a long-lived token, lists the
 * candidate pages/IG accounts and stores them (encrypted) for the admin to pick from.
 */
export async function completeOAuthCallback(params: { code?: string | null; state?: string | null; errorMessage?: string | null }): Promise<OAuthCallbackResult> {
  if (!params.state) return { ok: false, sessionId: null, error: 'Falta el parámetro state' }
  const session = await prisma.channelOAuthSession.findUnique({ where: { state: params.state } })
  if (!session) return { ok: false, sessionId: null, error: 'Sesión OAuth inválida' }
  if (session.expiresAt.getTime() < Date.now() || session.status !== 'pending') {
    await prisma.channelOAuthSession.update({ where: { id: session.id }, data: { status: 'error', error: 'Sesión expirada' } }).catch(() => null)
    return { ok: false, sessionId: session.id, error: 'La sesión OAuth expiró, vuelve a intentarlo' }
  }

  const fail = async (message: string) => {
    await prisma.channelOAuthSession.update({ where: { id: session.id }, data: { status: 'error', error: message } }).catch(() => null)
    return { ok: false as const, sessionId: session.id, error: message }
  }

  if (params.errorMessage) return fail(params.errorMessage)
  if (!params.code) return fail('Meta no devolvió un código de autorización')

  try {
    const app = await requireMetaApp()
    const redirectUri = getOAuthRedirectUri()
    const shortToken = await exchangeCodeForUserToken(app, params.code, redirectUri)
    const longLived = await exchangeLongLivedToken(app, shortToken).catch((err) => {
      logger.warn('Long-lived exchange failed, using short token', { err: err instanceof Error ? err.message : err })
      return { token: shortToken, expiresIn: null }
    })
    const channel = session.channel as MetaChannel
    const candidates = await listPagesForChannel(app, longLived.token, channel)

    const tokenExpiresAt = longLived.expiresIn ? new Date(Date.now() + longLived.expiresIn * 1000).toISOString() : null
    await prisma.channelOAuthSession.update({
      where: { id: session.id },
      data: {
        status: 'ready',
        candidatesEncrypted: encryptConfig({ candidates, tokenExpiresAt }),
        expiresAt: new Date(Date.now() + OAUTH_SESSION_TTL_MS),
      },
    })
    return { ok: true, sessionId: session.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error durante la autorización'
    logger.error('OAuth callback failed', { sessionId: session.id, message })
    return fail(message)
  }
}

export type CandidateView = {
  id: string
  name: string
  pageId: string
  username?: string | null
  alreadyConnected: boolean
}

export async function getOAuthSessionCandidates(sessionId: string, adminId: string) {
  const session = await prisma.channelOAuthSession.findUnique({ where: { id: sessionId } })
  if (!session || session.adminId !== adminId) return null
  if (session.status === 'error') return { session, candidates: [] as CandidateView[], error: session.error || 'Error' }
  if (session.status !== 'ready' || !session.candidatesEncrypted) return { session, candidates: [] as CandidateView[], error: null }
  if (session.expiresAt.getTime() < Date.now()) return { session, candidates: [] as CandidateView[], error: 'La sesión expiró' }

  const payload = decryptConfig<{ candidates: MetaPageCandidate[] }>(session.candidatesEncrypted)
  const existing = await prisma.channelConnection.findMany({
    where: { channel: session.channel, externalId: { in: payload.candidates.map((c) => c.id) } },
    select: { externalId: true },
  })
  const taken = new Set(existing.map((e) => e.externalId))
  const candidates: CandidateView[] = payload.candidates.map((c) => ({
    id: c.id,
    name: c.name,
    pageId: c.pageId,
    username: c.username ?? null,
    alreadyConnected: taken.has(c.id),
  }))
  return { session, candidates, error: null }
}

export async function completeOAuthSelection(params: { sessionId: string; adminId: string; adminEmail: string | null; selectedIds: string[] }) {
  const session = await prisma.channelOAuthSession.findUnique({ where: { id: params.sessionId } })
  if (!session || session.adminId !== params.adminId) throw new Error('Sesión no encontrada')
  if (session.status !== 'ready' || !session.candidatesEncrypted) throw new Error('La sesión no está lista')
  if (session.expiresAt.getTime() < Date.now()) throw new Error('La sesión expiró')

  const app = await requireMetaApp()
  const channel = session.channel as MetaChannel
  const payload = decryptConfig<{ candidates: MetaPageCandidate[]; tokenExpiresAt: string | null }>(session.candidatesEncrypted)
  const chosen = payload.candidates.filter((c) => params.selectedIds.includes(c.id))
  if (chosen.length === 0) throw new Error('Selecciona al menos una cuenta')

  const results: Array<{ id: string; name: string; connectionId?: string; error?: string }> = []
  for (const candidate of chosen) {
    try {
      let subscribedFields: string[] = []
      let lastError: string | null = null
      try {
        subscribedFields = await subscribePageWithFallback(app, candidate.pageId, candidate.pageAccessToken, channel)
      } catch (err) {
        lastError = `Suscripción de webhook falló: ${err instanceof Error ? err.message : 'error'}`
        logger.warn('Page subscription failed', { pageId: candidate.pageId, lastError })
      }

      const meta: ConnectionMeta = {
        pageId: candidate.pageId,
        username: candidate.username ?? null,
        subscribedFields,
        tokenExpiresAt: payload.tokenExpiresAt,
      }
      const conn = await prisma.channelConnection.upsert({
        where: { channel_externalId: { channel, externalId: candidate.id } },
        create: {
          channel,
          externalId: candidate.id,
          name: candidate.name,
          status: lastError ? 'ERROR' : 'ACTIVE',
          enabled: true,
          credentialsEncrypted: encryptConfig({ pageAccessToken: candidate.pageAccessToken } satisfies ConnectionCredentials),
          meta: meta as unknown as Prisma.InputJsonValue,
          lastError,
          connectedByEmail: params.adminEmail,
        },
        update: {
          name: candidate.name,
          status: lastError ? 'ERROR' : 'ACTIVE',
          credentialsEncrypted: encryptConfig({ pageAccessToken: candidate.pageAccessToken } satisfies ConnectionCredentials),
          meta: meta as unknown as Prisma.InputJsonValue,
          lastError,
          connectedByEmail: params.adminEmail,
        },
      })
      runCapabilityDiagnostics(conn.id).catch(() => null)
      results.push({ id: candidate.id, name: candidate.name, connectionId: conn.id })
    } catch (err) {
      results.push({ id: candidate.id, name: candidate.name, error: err instanceof Error ? err.message : 'error' })
    }
  }

  await prisma.channelOAuthSession.update({
    where: { id: session.id },
    data: { status: 'completed', candidatesEncrypted: null },
  })

  return { channel, results }
}

// ─── Diagnostics ─────────────────────────────────────────────────────────────

export async function runCapabilityDiagnostics(connectionId: string): Promise<ConnectionCapabilities | null> {
  const conn = await prisma.channelConnection.findUnique({ where: { id: connectionId } })
  if (!conn || !isMetaChannel(conn.channel)) return null
  const app = await requireMetaApp()
  const creds = getConnectionCredentials(conn)
  const meta = getConnectionMeta(conn)
  if (!creds?.pageAccessToken) {
    const caps: ConnectionCapabilities = { receive: false, send: false, sendDetail: 'Sin token', receiveDetail: 'Sin token', checkedAt: new Date().toISOString() }
    await prisma.channelConnection.update({ where: { id: conn.id }, data: { capabilities: caps as unknown as Prisma.InputJsonValue, status: 'ERROR', lastError: 'Token no disponible' } })
    return caps
  }

  const [send, receive] = await Promise.all([
    probeSendCapability(app, creds.pageAccessToken),
    isPageSubscribed(app, meta.pageId || conn.externalId, creds.pageAccessToken)
      .then((r) => ({ ok: r.subscribed, detail: r.subscribed ? `Campos: ${r.fields.join(', ') || '—'}` : 'La app no está suscrita a la página' }))
      .catch((err) => ({ ok: false, detail: err instanceof Error ? err.message : 'error' })),
  ])

  const caps: ConnectionCapabilities = {
    receive: receive.ok,
    receiveDetail: conn.channel === 'INSTAGRAM' && receive.ok
      ? `${receive.detail}. Recuerda suscribir el objeto "instagram" en la consola de Meta.`
      : receive.detail,
    send: send.ok,
    sendDetail: send.detail,
    checkedAt: new Date().toISOString(),
  }

  const tokenInvalid = !send.ok && /\(#190\)/.test(send.detail)
  await prisma.channelConnection.update({
    where: { id: conn.id },
    data: {
      capabilities: caps as unknown as Prisma.InputJsonValue,
      status: tokenInvalid ? 'ERROR' : conn.status === 'ERROR' && send.ok && receive.ok ? 'ACTIVE' : conn.status,
      lastError: tokenInvalid ? 'Token inválido o expirado, vuelve a conectar la cuenta' : conn.lastError,
    },
  })
  return caps
}

export function describeGraphError(err: unknown) {
  if (err instanceof MetaGraphError) return err.code ? `(#${err.code}) ${err.message}` : err.message
  return err instanceof Error ? err.message : 'Error desconocido'
}

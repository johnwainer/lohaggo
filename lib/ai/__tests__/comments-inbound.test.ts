import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => {
  const messages = new Map<string, { id: string; providerMessageId: string; commentId: string }>()
  const conversations: Array<Record<string, unknown>> = []
  return {
    messages,
    conversations,
    prisma: {
      conversation: {
        findUnique: vi.fn(async ({ where }: { where: { channel_contactPhone: { channel: string; contactPhone: string } } }) =>
          conversations.find((c) => c.channel === where.channel_contactPhone.channel && c.contactPhone === where.channel_contactPhone.contactPhone) ?? null),
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const c = { id: `conv${conversations.length + 1}`, status: 'OPEN', ...data }
          conversations.push(c)
          return c
        }),
        update: vi.fn(async () => ({})),
      },
      conversationMessage: {
        create: vi.fn(async ({ data }: { data: { providerMessageId: string; commentId: string } }) => {
          if (messages.has(data.providerMessageId)) throw Object.assign(new Error('Unique constraint'), { code: 'P2002' })
          const m = { id: `m${messages.size + 1}`, providerMessageId: data.providerMessageId, commentId: data.commentId }
          messages.set(data.providerMessageId, m)
          return { id: m.id }
        }),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
    },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: db.prisma }))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {} }) }))
vi.mock('@/lib/messaging/inbox-emitter', () => ({ emitInboxEvent: vi.fn() }))
vi.mock('@/lib/ai/autopilot', () => ({ autopilotCovers: vi.fn(async () => true), scheduleInboundAgent: vi.fn() }))
vi.mock('@/lib/messaging/meta-inbound', () => ({ pickAutoAssignAgent: vi.fn(async () => null) }))
vi.mock('@/lib/inbox/contacts', () => ({ resolveInboundContact: vi.fn(async () => ({ id: 'contact1', name: 'Ana Pérez', userId: null })) }))
vi.mock('@/lib/messaging/meta-channels', () => ({
  getConnectionCredentials: () => ({ pageAccessToken: 'token' }),
  getConnectionMeta: () => ({ pageId: '877082332165769' }),
}))
vi.mock('@/lib/messaging/meta-graph', () => ({
  fetchPostInfo: vi.fn(async (_app: unknown, _t: string, _ch: string, postId: string) => ({ caption: 'Promo', permalink: 'https://facebook.com/p', mediaUrl: null, isAd: postId.endsWith('_ad') })),
  fetchMentionedComment: vi.fn(async () => ({ id: 'mc1', text: '@lohaggo_ ¿hacen esto?', username: 'otra.cuenta', media: { id: 'media9' } })),
}))

import { processCommentChanges } from '@/lib/messaging/meta-comments'
import { scheduleInboundAgent } from '@/lib/ai/autopilot'
import type { ChannelConnection } from '@prisma/client'
import type { MetaAppConfig } from '@/lib/messaging/provider-config'

const app = { appId: '1', appSecret: 's', graphVersion: 'v26.0' } as MetaAppConfig
const conn = (settings: Record<string, unknown> = {}, channel = 'MESSENGER', externalId = '877082332165769') =>
  ({ id: 'conn1', workspaceId: 'ws1', channel, externalId, name: 'LoHaggo', commentSettings: { enabled: true, ...settings } }) as unknown as ChannelConnection
const comment = (commentId: string, fromId = '24242424242', postId = '877082332165769_111', verb = 'add') => ({
  field: 'feed',
  value: { item: 'comment', verb, comment_id: commentId, post_id: postId, from: { id: fromId, name: 'Ana Pérez' }, message: '¿Precio?', created_time: 1790262000 },
})

beforeEach(() => {
  db.messages.clear()
  db.conversations.length = 0
  vi.mocked(scheduleInboundAgent).mockClear()
})

describe('entrada de comentarios', () => {
  it('idempotente por commentId: los reintentos de Meta no duplican ni despiertan dos veces al agente', async () => {
    const first = await processCommentChanges(app, conn(), 'MESSENGER', [comment('111_222')])
    const retry = await processCommentChanges(app, conn(), 'MESSENGER', [comment('111_222')])
    expect(first.counts).toEqual({ comment: 1 })
    expect(retry.counts).toEqual({ duplicate: 1 })
    expect(db.messages.size).toBe(1)
    expect(db.messages.get('comment:111_222')?.commentId).toBe('111_222')
    expect(scheduleInboundAgent).toHaveBeenCalledTimes(1)
  })

  it('una conversación por persona y publicación', async () => {
    await processCommentChanges(app, conn(), 'MESSENGER', [comment('1'), comment('2'), comment('3', '999'), comment('4', '24242424242', '877082332165769_222')])
    expect(db.conversations.map((c) => c.contactPhone)).toEqual(['24242424242:877082332165769_111', '999:877082332165769_111', '24242424242:877082332165769_222'])
    expect(db.conversations[0]).toMatchObject({ channel: 'FACEBOOK_COMMENT', rootCommentId: '1', postCaption: 'Promo', contactId: 'contact1', commentKind: 'comment' })
  })

  it('nunca procesa los comentarios de la propia página (evita bucles)', async () => {
    const r = await processCommentChanges(app, conn(), 'MESSENGER', [comment('5', '877082332165769')])
    expect(r.counts).toEqual({ own: 1 })
    expect(scheduleInboundAgent).not.toHaveBeenCalled()
  })

  it('anuncios excluidos cuando la cuenta no los incluye', async () => {
    const r = await processCommentChanges(app, conn({ includeAds: false }), 'MESSENGER', [comment('6', '1', '877082332165769_ad'), comment('7', '1')])
    expect(r.counts).toEqual({ ad_excluded: 1, comment: 1 })
  })

  it('un comentario eliminado se marca, no se borra', async () => {
    const r = await processCommentChanges(app, conn(), 'MESSENGER', [comment('111_222', '1', '877082332165769_111', 'remove')])
    expect(r.counts).toEqual({ removed: 1 })
    expect(db.prisma.conversationMessage.updateMany).toHaveBeenCalledWith({ where: { commentId: '111_222' }, data: { commentDeletedAt: expect.any(Date) } })
  })

  it('menciones solo con la opción activa', async () => {
    const mention = { field: 'mentions', value: { media_id: 'media9', comment_id: 'mc1' } }
    const ig = (s: Record<string, unknown>) => conn(s, 'INSTAGRAM', '17841407143223615')
    expect((await processCommentChanges(app, ig({}), 'INSTAGRAM', [mention])).counts).toEqual({ mention_off: 1 })
    expect((await processCommentChanges(app, ig({ mentions: true }), 'INSTAGRAM', [mention])).counts).toEqual({ comment: 1 })
    expect(db.conversations[0]).toMatchObject({ channel: 'INSTAGRAM_COMMENT', commentKind: 'mention', contactPhone: 'ig:otra.cuenta:media9' })
  })

  it('lo que no es un comentario queda contado como ignorado', async () => {
    const r = await processCommentChanges(app, conn(), 'MESSENGER', [{ field: 'feed', value: { item: 'reaction', verb: 'add' } }])
    expect(r.counts).toEqual({ 'ignorado:feed:reaction': 1 })
  })
})

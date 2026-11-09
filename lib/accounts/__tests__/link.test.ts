import { beforeEach, describe, expect, it, vi } from 'vitest'

type CodeRow = { id: string; contactId: string; conversationId: string; userId: string; codeHash: string; sentTo: string; expiresAt: Date; attempts: number; usedAt: Date | null; createdAt: Date }

const db = vi.hoisted(() => {
  const codes: CodeRow[] = []
  const users: Array<{ id: string; role: string; name: string; phone: string | null; email: string; isActive: boolean; phoneVerifiedAt?: Date | null; acquisition?: unknown }> = []
  const conv = { value: { id: 'conv1', workspaceId: 'ws1', channel: 'WHATSAPP', contactPhone: '+573001234567', contactId: 'ct1', userId: null as string | null } }
  const events: Array<Record<string, unknown>> = []
  return {
    codes, users, events, conv,
    prisma: {
      contactLinkCode: {
        count: vi.fn(async ({ where }: { where: { conversationId: string; createdAt: { gte: Date } } }) =>
          codes.filter((c) => c.conversationId === where.conversationId && c.createdAt >= where.createdAt.gte).length),
        create: vi.fn(async ({ data }: { data: Omit<CodeRow, 'attempts' | 'usedAt' | 'createdAt'> }) => {
          const row: CodeRow = { ...data, attempts: 0, usedAt: null, createdAt: new Date() }
          codes.push(row)
          return row
        }),
        delete: vi.fn(async ({ where }: { where: { id: string } }) => { const i = codes.findIndex((c) => c.id === where.id); if (i >= 0) codes.splice(i, 1); return {} }),
        findFirst: vi.fn(async ({ where }: { where: { conversationId: string; contactId: string; expiresAt: { gt: Date } } }) =>
          [...codes].reverse().find((c) => c.conversationId === where.conversationId && c.contactId === where.contactId && !c.usedAt && c.expiresAt > where.expiresAt.gt) ?? null),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: { attempts?: { increment: number }; usedAt?: Date } }) => {
          const row = codes.find((c) => c.id === where.id)!
          if (data.attempts) row.attempts += data.attempts.increment
          if (data.usedAt) row.usedAt = data.usedAt
          return row
        }),
      },
      user: {
        findFirst: vi.fn(async ({ where }: { where: { OR: Array<{ phone?: string; email?: string }> } }) =>
          users.find((u) => u.isActive && where.OR.some((o) => (o.phone && o.phone === u.phone) || (o.email && o.email === u.email))) ?? null),
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => users.find((u) => u.id === where.id) ?? null),
        findMany: vi.fn(async ({ where }: { where: { phone: { in: string[] } } }) => users.filter((u) => u.phone && where.phone.in.includes(u.phone)).map((u) => ({ ...u, phoneVerifiedAt: u.phoneVerifiedAt ?? null }))),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => { const u = users.find((x) => x.id === where.id)!; Object.assign(u, data); return u }),
      },
      conversation: { findUnique: vi.fn(async () => conv.value) },
      conversationEvent: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { events.push(data); return data }) },
    },
  }
})

const sent = vi.hoisted(() => ({ messages: [] as Array<{ channel: string; to: string; body: string }>, fail: false }))
const contacts = vi.hoisted(() => ({ updateContact: vi.fn(async () => ({})) }))

vi.mock('@/lib/prisma', () => ({ prisma: db.prisma }))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {} }) }))
vi.mock('@/lib/inbox/contacts', () => ({
  toE164: (raw: string | null | undefined) => (raw && /^\+\d{8,15}$/.test(raw.replace(/[\s-]/g, '')) ? raw.replace(/[\s-]/g, '') : null),
  updateContact: contacts.updateContact,
}))
vi.mock('@/lib/messaging/providers', () => ({
  sendMessageViaProvider: vi.fn(async (p: { channel: string; to: string; body: string }) => {
    sent.messages.push(p)
    return sent.fail ? { ok: false, provider: 'x', errorMessage: 'down' } : { ok: true, provider: 'x' }
  }),
}))
vi.mock('@/lib/messaging/provider-config', () => ({ getMessagingProviderRuntimeConfig: vi.fn(async () => ({})) }))
vi.mock('@/lib/messaging/inbox-emitter', () => ({ emitInboxEvent: vi.fn() }))
const limits = vi.hoisted(() => ({ hits: new Map<string, number>() }))
vi.mock('@/lib/rate-limit-store', () => ({
  overLimit: vi.fn(async (key: string, _ms: number, max: number) => {
    const n = (limits.hits.get(key) ?? 0) + 1
    limits.hits.set(key, n)
    return { blocked: n > max, retryAfterSec: 40, count: n }
  }),
}))

import { LINK_CODES_PER_DAY, confirmLink, linkByWhatsappNumber, maskPhone, startLink } from '@/lib/accounts/link'

const actor = { agentId: 'a1', agentName: 'Sofía' }
const base = { conversationId: 'conv1', contactId: 'ct1', actor }
const lastCode = () => sent.messages.at(-1)!.body.match(/\b(\d{6})\b/)![1]

beforeEach(() => {
  db.codes.length = 0
  db.users.length = 0
  db.events.length = 0
  sent.messages.length = 0
  sent.fail = false
  limits.hits.clear()
  db.users.push({ id: 'u1', role: 'PARTNER', name: 'Luis Gómez', phone: '+573001234567', email: 'luis@gmail.com', isActive: true })
  db.conv.value = { id: 'conv1', workspaceId: 'ws1', channel: 'WHATSAPP', contactPhone: '+573001234567', contactId: 'ct1', userId: null }
  vi.clearAllMocks()
})

describe('startLink', () => {
  it('responde idéntico exista o no la cuenta, y solo envía cuando existe', async () => {
    const known = await startLink({ ...base, via: 'phone', phone: '300 123 4567' })
    const unknown = await startLink({ ...base, conversationId: 'conv2', via: 'phone', phone: '300 999 8888' })
    expect(known).toEqual({ ok: true, sentTo: '+57•••••4567' })
    expect(unknown).toEqual({ ok: true, sentTo: '+57•••••8888' })
    expect(Object.keys(known)).toEqual(Object.keys(unknown))
    expect(sent.messages).toHaveLength(1)
    expect(sent.messages[0]).toMatchObject({ channel: 'WHATSAPP', to: '+573001234567' })
    expect(sent.messages[0].body).toMatch(/Tu código para vincular tu cuenta LoHaggo es \d{6}\. Vence en 10 minutos/)
    expect(db.codes).toHaveLength(1)
    expect(db.codes[0].codeHash).not.toContain(lastCode())
  })

  it('por correo envía EMAIL al correo de la cuenta y enmascara', async () => {
    const r = await startLink({ ...base, via: 'email', email: 'Luis@Gmail.com' })
    expect(r).toEqual({ ok: true, sentTo: 'lu**@gmail.com' })
    expect(sent.messages[0]).toMatchObject({ channel: 'EMAIL', to: 'luis@gmail.com' })
    const none = await startLink({ ...base, conversationId: 'c9', via: 'email', email: 'nadie@x.co' })
    expect(none).toEqual({ ok: true, sentTo: 'na***@x.co' })
    expect(sent.messages).toHaveLength(1)
  })

  it('tope diario por conversación', async () => {
    for (let i = 0; i < LINK_CODES_PER_DAY; i++) {
      expect((await startLink({ ...base, via: 'phone', phone: '+573001234567' })).ok).toBe(true)
      // spread over the day: the per-minute pacing is tested apart
      limits.hits.clear()
    }
    expect(await startLink({ ...base, via: 'phone', phone: '+573001234567' })).toMatchObject({ ok: false, code: 'limit' })
    expect(db.codes).toHaveLength(LINK_CODES_PER_DAY)
  })

  it('un código por minuto: el segundo seguido espera y no se envía', async () => {
    expect((await startLink({ ...base, via: 'phone', phone: '300-123-4567' })).ok).toBe(true)
    const again = await startLink({ ...base, via: 'phone', phone: '300 123 4567' })
    expect(again).toMatchObject({ ok: false, code: 'wait' })
    expect(again.ok ? '' : again.error).toMatch(/hace un momento/)
    expect(sent.messages).toHaveLength(1)
  })

  it('el ritmo responde igual exista o no la cuenta', async () => {
    await startLink({ ...base, conversationId: 'c7', via: 'phone', phone: '300 999 8888' })
    expect(await startLink({ ...base, conversationId: 'c7', via: 'phone', phone: '300 999 8888' })).toMatchObject({ ok: false, code: 'wait' })
    expect(sent.messages).toHaveLength(0)
  })

  it('un fijo se rechaza con un mensaje claro', async () => {
    const r = await startLink({ ...base, via: 'phone', phone: '604 444 1234' })
    expect(r).toMatchObject({ ok: false, code: 'invalid' })
    expect(r.ok ? '' : r.error).toMatch(/fijo/)
    expect(sent.messages).toHaveLength(0)
  })

  it('si no se puede enviar, no deja código', async () => {
    sent.fail = true
    expect(await startLink({ ...base, via: 'phone', phone: '+573001234567' })).toMatchObject({ ok: false, code: 'send_failed' })
    expect(sent.messages.map((m) => m.channel)).toEqual(['WHATSAPP', 'SMS'])
    expect(db.codes).toHaveLength(0)
  })
})

describe('confirmLink', () => {
  it('código correcto vincula el contacto y deja el evento', async () => {
    await startLink({ ...base, via: 'phone', phone: '+573001234567' })
    const r = await confirmLink({ ...base, code: ` ${lastCode()} ` })
    expect(r).toEqual({ ok: true, userId: 'u1', role: 'PARTNER', name: 'Luis Gómez' })
    expect(contacts.updateContact).toHaveBeenCalledWith('ct1', { userId: 'u1' })
    expect(db.events[0]).toMatchObject({ type: 'account_linked', actorType: 'ai', actorId: 'a1', detail: 'Vinculado por código a lu**@gmail.com' })
    expect(db.codes[0].usedAt).toBeInstanceOf(Date)
    // A used code cannot be replayed
    expect(await confirmLink({ ...base, code: lastCode() })).toMatchObject({ ok: false, code: 'expired' })
  })

  it('3 fallos bloquean, incluso con el código correcto después', async () => {
    await startLink({ ...base, via: 'phone', phone: '+573001234567' })
    expect(await confirmLink({ ...base, code: '000000' })).toMatchObject({ ok: false, code: 'wrong', remaining: 2 })
    expect(await confirmLink({ ...base, code: '000001' })).toMatchObject({ ok: false, code: 'wrong', remaining: 1 })
    expect(await confirmLink({ ...base, code: '000002' })).toMatchObject({ ok: false, code: 'locked' })
    expect(await confirmLink({ ...base, code: lastCode() })).toMatchObject({ ok: false, code: 'locked' })
    expect(contacts.updateContact).not.toHaveBeenCalled()
  })

  it('vencido falla', async () => {
    await startLink({ ...base, via: 'phone', phone: '+573001234567' })
    db.codes[0].expiresAt = new Date(Date.now() - 1000)
    expect(await confirmLink({ ...base, code: lastCode() })).toMatchObject({ ok: false, code: 'expired' })
    expect(contacts.updateContact).not.toHaveBeenCalled()
  })

  it('sin código pedido falla igual', async () => {
    expect(await confirmLink({ ...base, code: '123456' })).toMatchObject({ ok: false, code: 'expired' })
  })
})

describe('maskPhone', () => {
  it('deja indicativo y últimos 4', () => {
    expect(maskPhone('+573001234567')).toBe('+57•••••4567')
    expect(maskPhone('3001234567')).toBe('•••••4567')
  })
})

describe('linkByWhatsappNumber', () => {
  it('vincula sin código cuando una sola cuenta tiene el número del WhatsApp y marca el teléfono confirmado', async () => {
    db.users[0].phone = '3001234567' // stored before normalization was strict
    db.users[0].acquisition = { source: 'inbox' } // the account was created from a chat
    const r = await linkByWhatsappNumber({ conversationId: 'conv1', actor })
    expect(r).toEqual({ ok: true, userId: 'u1', role: 'PARTNER', name: 'Luis Gómez', already: false })
    expect(contacts.updateContact).toHaveBeenCalledWith('ct1', { userId: 'u1' })
    expect(db.users[0].phone).toBe('+573001234567')
    expect(db.users[0].phoneVerifiedAt).toBeInstanceOf(Date)
    expect(db.events[0]).toMatchObject({ type: 'account_linked', detail: 'Vinculado por su número de WhatsApp a lu**@gmail.com' })
    expect(sent.messages).toHaveLength(0)
  })

  it('una cuenta registrada en la web se vincula, pero su teléfono no queda confirmado (podría ser un error al escribirlo)', async () => {
    db.users[0].acquisition = { source: 'google' }
    const r = await linkByWhatsappNumber({ conversationId: 'conv1', actor })
    expect(r).toMatchObject({ ok: true, userId: 'u1' })
    expect(db.users[0].phoneVerifiedAt ?? null).toBeNull()
  })

  it('nunca a un admin ni a un número con varias cuentas', async () => {
    db.users.push({ id: 'u2', role: 'CLIENT', name: 'Otra', phone: '+573001234567', email: 'otra@x.co', isActive: true })
    expect(await linkByWhatsappNumber({ conversationId: 'conv1' })).toEqual({ ok: false, reason: 'ambiguous' })
    db.users.splice(0, 2, { id: 'a1', role: 'ADMIN', name: 'Admin', phone: '+573001234567', email: 'a@x.co', isActive: true })
    expect(await linkByWhatsappNumber({ conversationId: 'conv1' })).toEqual({ ok: false, reason: 'admin' })
    expect(contacts.updateContact).not.toHaveBeenCalled()
  })

  it('solo en WhatsApp', async () => {
    db.conv.value = { ...db.conv.value, channel: 'MESSENGER' }
    expect(await linkByWhatsappNumber({ conversationId: 'conv1' })).toEqual({ ok: false, reason: 'not_whatsapp' })
  })

  it('una conversación ya vinculada confirma el teléfono si es el mismo número y la cuenta nació del chat', async () => {
    db.conv.value = { ...db.conv.value, userId: 'u1' }
    db.users[0].acquisition = { source: 'inbox' }
    const r = await linkByWhatsappNumber({ conversationId: 'conv1' })
    expect(r).toMatchObject({ ok: true, userId: 'u1', already: true })
    expect(db.users[0].phoneVerifiedAt).toBeInstanceOf(Date)
    expect(contacts.updateContact).not.toHaveBeenCalled()
  })
})

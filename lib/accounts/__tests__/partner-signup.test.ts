import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  magicCreate: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'mt', ...data })),
  userFind: vi.fn(async () => null as unknown),
  userCreate: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'u1', email: data.email, name: data.name, phone: data.phone, role: data.role,
    partnerProfile: data.role === 'PARTNER' ? { id: 'p1' } : null,
  })),
  createAccessLink: vi.fn(async () => ({ url: 'https://www.lohaggo.com/auth/magic?token=abc', expiresAt: new Date() })),
  emailAccessLink: vi.fn(async () => ({ ok: true as const })),
  send: vi.fn(async () => ({ ok: true })),
  hash: vi.fn(async (p: string) => `hashed:${p}`),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    magicToken: { create: m.magicCreate },
    user: { findUnique: m.userFind, create: m.userCreate },
    cityConfig: { findUnique: vi.fn(async () => null) },
    service: { findMany: vi.fn(async () => []) },
    partnerService: { createMany: vi.fn(async () => ({ count: 0 })) },
  },
}))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {} }) }))
vi.mock('@/lib/accounts/from-contact', () => ({
  createAccessLink: m.createAccessLink,
  emailAccessLink: m.emailAccessLink,
  accessLinkMessage: (name: string, _role: string, url: string) => `${name} ${url}`,
}))
vi.mock('@/lib/messaging/providers', () => ({ sendMessageViaProvider: m.send }))
vi.mock('@/lib/messaging/provider-config', () => ({ getMessagingProviderRuntimeConfig: vi.fn(async () => ({})) }))
vi.mock('@/lib/inbox/contacts', () => ({ toE164: (p: string | null | undefined) => (p ? `+57${p.replace(/\D/g, '').slice(-10)}` : null) }))
vi.mock('@/lib/messaging/whatsapp-templates', () => ({ sendWelcomePartner: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/lib/messaging/automation-service', () => ({ scheduleAutomationsForUser: vi.fn(async () => null) }))
vi.mock('@/lib/security/bot-protection', () => ({
  getClientIpFromHeaders: () => '1.1.1.1',
  isLikelyBotSubmission: () => false,
  verifyTurnstileToken: vi.fn(async () => true),
}))
vi.mock('@/lib/rate-limit', () => ({ registerRateLimiter: (req: NextRequest, h: (r: NextRequest) => Promise<Response>) => h(req) }))
vi.mock('@/lib/analytics/acquisition', () => ({ acquisitionFrom: () => null }))
vi.mock('bcryptjs', () => ({ default: { hash: m.hash } }))

import { createSessionHandoffToken, deliverPartnerAccessLink, generateStrongPassword, SESSION_HANDOFF_TTL_MIN } from '@/lib/accounts/partner-signup'
import { POST } from '@/app/api/register/route'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateStrongPassword', () => {
  it('is long, random and not derived from the name', () => {
    const a = generateStrongPassword()
    const b = generateStrongPassword()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThanOrEqual(32)
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('createSessionHandoffToken', () => {
  it('stores a short single-use token that does not force a password change', async () => {
    const token = await createSessionHandoffToken('u1')
    expect(token).toMatch(/^[a-f0-9]{64}$/)
    const data = (m.magicCreate.mock.calls[0] as unknown as [{ data: { requirePasswordChange: boolean; expiresAt: Date; userId: string } }])[0].data
    expect(data.userId).toBe('u1')
    expect(data.requirePasswordChange).toBe(false)
    expect(data.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(SESSION_HANDOFF_TTL_MIN * 60_000)
  })
})

describe('deliverPartnerAccessLink', () => {
  it('sends the access link by email and WhatsApp', async () => {
    const sent = await deliverPartnerAccessLink({ id: 'u1', email: 'a@b.co', name: 'Ana', phone: '3001112233' })
    expect(m.createAccessLink).toHaveBeenCalledWith('u1', 'PARTNER')
    expect(m.emailAccessLink).toHaveBeenCalledWith('a@b.co', 'Ana', 'PARTNER', 'https://www.lohaggo.com/auth/magic?token=abc')
    expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ channel: 'WHATSAPP', body: expect.stringContaining('auth/magic?token=abc') }), expect.anything())
    expect(sent).toEqual({ email: true, whatsapp: true })
  })

  it('never throws and reports what failed', async () => {
    m.emailAccessLink.mockResolvedValueOnce({ ok: false, error: 'Correo no configurado' } as never)
    m.send.mockRejectedValueOnce(new Error('twilio down'))
    await expect(deliverPartnerAccessLink({ id: 'u1', email: 'a@b.co', name: 'Ana', phone: '3001112233' })).resolves.toEqual({ email: false, whatsapp: false })
    m.createAccessLink.mockRejectedValueOnce(new Error('db'))
    await expect(deliverPartnerAccessLink({ id: 'u1', email: 'a@b.co', name: 'Ana' })).resolves.toEqual({ email: false, whatsapp: false })
  })
})

function registerRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/register', {
    method: 'POST',
    body: JSON.stringify({ formStartedAt: String(Date.now() - 60_000), ...body }),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/register', () => {
  it('partner without password: random server password, access link and session handoff', async () => {
    const res = await POST(registerRequest({ name: 'Carlos Ruiz', email: 'carlos@x.co', phone: '3001112233', role: 'PARTNER' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.sessionToken).toMatch(/^[a-f0-9]{64}$/)
    expect(json.accessLinkSent).toEqual({ email: true, whatsapp: true })
    expect(JSON.stringify(json)).not.toMatch(/password/i)
    const hashedInput = m.hash.mock.calls[0][0]
    expect(hashedInput.length).toBeGreaterThanOrEqual(32)
    expect(hashedInput.toLowerCase()).not.toContain('carlos')
    expect(m.createAccessLink).toHaveBeenCalledWith('u1', 'PARTNER')
  })

  it('client keeps choosing the password and gets no token', async () => {
    const res = await POST(registerRequest({ name: 'Laura', email: 'laura@x.co', password: 'secreta123', role: 'CLIENT' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.sessionToken).toBeUndefined()
    expect(m.hash).toHaveBeenCalledWith('secreta123', 10)
    expect(m.createAccessLink).not.toHaveBeenCalled()
  })

  it('client without password is rejected', async () => {
    const res = await POST(registerRequest({ name: 'Laura', email: 'laura@x.co', role: 'CLIENT' }))
    expect(res.status).toBe(400)
    expect(m.userCreate).not.toHaveBeenCalled()
  })

  it('partner with own password (/register) keeps it and gets no token', async () => {
    const res = await POST(registerRequest({ name: 'Pedro', email: 'pedro@x.co', password: 'mipass123', role: 'PARTNER' }))
    expect(res.status).toBe(201)
    expect((await res.json()).sessionToken).toBeUndefined()
    expect(m.hash).toHaveBeenCalledWith('mipass123', 10)
  })
})

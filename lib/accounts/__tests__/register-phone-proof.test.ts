import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const SECRET = 'test-secret'

const m = vi.hoisted(() => ({
  userCount: vi.fn(async () => 0),
  userCreate: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'u1', email: data.email, name: data.name, phone: data.phone, role: data.role, partnerProfile: { id: 'p1' },
  })),
  // code rows: id -> used / expiry
  rows: new Map<string, { phone: string; usedAt: Date | null; expiresAt: Date }>(),
  deliver: vi.fn(async () => ({ email: false, whatsapp: true })),
}))

vi.mock('@/lib/env', () => ({ env: { SECURITY_INTERNAL_TOKEN: SECRET } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(async () => null), create: m.userCreate, count: m.userCount },
    phoneLoginCode: {
      updateMany: vi.fn(async ({ where, data }: { where: { id: string; phone?: string; usedAt: null; expiresAt?: { gt: Date } }; data: { usedAt: Date } }) => {
        const row = m.rows.get(where.id)
        if (!row || row.usedAt || (where.phone && row.phone !== where.phone) || (where.expiresAt && row.expiresAt <= where.expiresAt.gt)) return { count: 0 }
        row.usedAt = data.usedAt
        return { count: 1 }
      }),
    },
    cityConfig: { findUnique: vi.fn(async () => null) },
    service: { findMany: vi.fn(async () => []) },
    partnerService: { createMany: vi.fn(async () => ({ count: 0 })) },
    magicToken: { create: vi.fn(async () => ({})) },
  },
}))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {} }) }))
vi.mock('@/lib/accounts/partner-signup', () => ({
  deliverPartnerAccessLink: m.deliver,
  createSessionHandoffToken: vi.fn(async () => 'tok'),
  generateStrongPassword: () => 'x'.repeat(32),
}))
vi.mock('@/lib/accounts/access-link', () => ({ sendAccessLink: vi.fn() }))
vi.mock('@/lib/messaging/providers', () => ({ sendMessageViaProvider: vi.fn() }))
vi.mock('@/lib/messaging/provider-config', () => ({ getMessagingProviderRuntimeConfig: vi.fn(async () => ({})) }))
vi.mock('@/lib/rate-limit-store', () => ({ overLimit: vi.fn(async () => ({ blocked: false, retryAfterSec: 1, count: 1 })) }))
vi.mock('@/lib/messaging/wa-events', () => ({ waAccountCreated: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/lib/messaging/automation-service', () => ({ scheduleAutomationsForUser: vi.fn(async () => null) }))
vi.mock('@/lib/security/bot-protection', () => ({
  getClientIpFromHeaders: () => '1.1.1.1',
  isLikelyBotSubmission: () => false,
  verifyTurnstileToken: vi.fn(async () => true),
}))
vi.mock('@/lib/rate-limit', () => ({ registerRateLimiter: (req: NextRequest, h: (r: NextRequest) => Promise<Response>) => h(req) }))
vi.mock('@/lib/analytics/acquisition', () => ({ acquisitionFrom: () => null }))
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn(async (p: string) => `hashed:${p}`) } }))

import { signPhoneProof } from '@/lib/accounts/phone-proof'
import { POST } from '@/app/api/register/route'

const PHONE = '3001112233'
const E164 = '+573001112233'

function proofFor(phone: string, codeId: string, exp = Date.now() + 600_000) {
  return signPhoneProof({ phone, codeId, exp }, SECRET)
}

function seedCode(id: string, phone = E164, expiresAt = new Date(Date.now() + 600_000)) {
  m.rows.set(id, { phone, usedAt: null, expiresAt })
}

function req(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/register', {
    method: 'POST',
    body: JSON.stringify({ formStartedAt: String(Date.now() - 60_000), name: 'Carlos Ruiz', phone: PHONE, role: 'PARTNER', ...body }),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  m.rows.clear()
  m.userCount.mockResolvedValue(0)
})

describe('POST /api/register without email', () => {
  it('refuses without a proof', async () => {
    const res = await POST(req({}))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('phone_proof_required')
    expect(m.userCreate).not.toHaveBeenCalled()
  })

  it('refuses a made-up proof', async () => {
    seedCode('c1')
    const res = await POST(req({ phoneProof: `c1.${Date.now() + 600_000}.forged` }))
    expect(res.status).toBe(403)
    expect(m.userCreate).not.toHaveBeenCalled()
  })

  it('accepts a valid proof: placeholder email and phone confirmed', async () => {
    seedCode('c1')
    const res = await POST(req({ phoneProof: proofFor(E164, 'c1') }))
    expect(res.status).toBe(201)
    const data = (m.userCreate.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data
    expect(data.email).toBe('wa-573001112233@clientes.lohaggo.com')
    expect(data.phoneVerifiedAt).toBeInstanceOf(Date)
    expect(m.deliver).toHaveBeenCalled()
  })

  it('rejects a proof issued for another number', async () => {
    seedCode('c1', '+573009998877')
    const res = await POST(req({ phoneProof: proofFor('+573009998877', 'c1') }))
    expect(res.status).toBe(403)
    expect(m.userCreate).not.toHaveBeenCalled()
  })

  it('rejects an expired proof', async () => {
    seedCode('c1')
    const res = await POST(req({ phoneProof: proofFor(E164, 'c1', Date.now() - 1000) }))
    expect(res.status).toBe(403)
    expect(m.userCreate).not.toHaveBeenCalled()
  })

  it('rejects a proof whose code expired or was already used (single use)', async () => {
    seedCode('c1')
    const proof = proofFor(E164, 'c1')
    expect((await POST(req({ phoneProof: proof }))).status).toBe(201)
    m.userCount.mockResolvedValue(0)
    const replay = await POST(req({ phoneProof: proof }))
    expect(replay.status).toBe(403)
    expect(m.userCreate).toHaveBeenCalledTimes(1)
  })

  it('refuses when the number already has an account, with or without proof', async () => {
    seedCode('c1')
    m.userCount.mockResolvedValue(1)
    const res = await POST(req({ phoneProof: proofFor(E164, 'c1') }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('Ya tienes cuenta: entra con tu celular.')
    expect(m.userCreate).not.toHaveBeenCalled()
    expect(m.rows.get('c1')?.usedAt).toBeNull()
  })

  it('does not let a typed placeholder address skip the proof', async () => {
    const res = await POST(req({ email: 'wa-573001112233@clientes.lohaggo.com' }))
    expect(res.status).toBe(400)
    expect(m.userCreate).not.toHaveBeenCalled()
  })

  it('a client cannot register without email', async () => {
    const res = await POST(req({ role: 'CLIENT', password: 'secreta123' }))
    expect(res.status).toBe(400)
    expect(m.userCreate).not.toHaveBeenCalled()
  })

  it('with an email nothing changes: phone is not claimed as verified', async () => {
    const res = await POST(req({ email: 'carlos@x.co' }))
    expect(res.status).toBe(201)
    const data = (m.userCreate.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data
    expect(data.email).toBe('carlos@x.co')
    expect(data.phoneVerifiedAt).toBeUndefined()
  })
})

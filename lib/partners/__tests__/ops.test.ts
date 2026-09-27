import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => {
  const state = {
    partner: { id: 'p1', userId: 'u1', city: 'MEDELLIN' } as Record<string, unknown> | null,
    service: { id: 's1', name: 'Plomería', basePrice: 50_000 } as Record<string, unknown> | null,
    existing: null as Record<string, unknown> | null,
    activeCount: 0,
    config: { minServicePrice: 20_000, maxServicePrice: 2_000_000 } as Record<string, unknown> | null,
  }
  return {
    state,
    prisma: {
      partnerProfile: { findUnique: vi.fn(async () => state.partner) },
      service: { findUnique: vi.fn(async () => state.service) },
      platformConfig: { findFirst: vi.fn(async () => state.config) },
      partnerService: {
        findUnique: vi.fn(async () => state.existing),
        findFirst: vi.fn(async () => null),
        count: vi.fn(async () => state.activeCount),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'ps-new', ...data, service: state.service })),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...state.existing, ...data, service: state.service })),
      },
      verificationDocument: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'd1', ...data })) },
    },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: db.prisma }))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {} }) }))
vi.mock('@/lib/cloudinary', () => ({ cloudinaryService: { upload: vi.fn(async () => ({ url: 'https://res.cloudinary.com/x/doc.jpg', publicId: 'doc' })) } }))
vi.mock('@/lib/notifications/notificationService', () => ({ createNotification: vi.fn(async () => ({})) }))
vi.mock('@/lib/banking/catalog', () => ({ findColombiaBankByName: vi.fn(async () => null) }))
vi.mock('@/lib/ops/platform-ops', () => ({ setPartnerAvailability: vi.fn(async () => ({ previous: true })) }))
vi.mock('@/lib/messaging/provider-config', () => ({ getMessagingProviderRuntimeConfig: vi.fn(async () => ({ twilio: { config: null } })) }))
vi.mock('@/lib/messaging/attachments', () => ({ isTrustedAttachmentUrl: () => false }))

import { MAX_ACTIVE_SERVICES, missingDocuments, parseCity, upsertPartnerService, uploadDocument } from '@/lib/partners/ops'
import { validateColombianBankAccount } from '@/lib/banking/validate'
import { APP_ORIGIN, OpsError, type Actor } from '@/lib/ops/origin'

const actor: Actor = { userId: 'u1', role: 'PARTNER', partnerId: 'p1' }

const failsWith = async (p: Promise<unknown>, status: number) => {
  const err = await p.then(() => null, (e) => e)
  expect(err).toBeInstanceOf(OpsError)
  expect((err as OpsError).status).toBe(status)
  return (err as OpsError).message
}

beforeEach(() => {
  db.state.partner = { id: 'p1', userId: 'u1', city: 'MEDELLIN' }
  db.state.service = { id: 's1', name: 'Plomería', basePrice: 50_000 }
  db.state.existing = null
  db.state.activeCount = 0
  db.state.config = { minServicePrice: 20_000, maxServicePrice: 2_000_000 }
  vi.clearAllMocks()
})

describe('upsertPartnerService', () => {
  it('precio < basePrice → 400; sin precio usa basePrice', async () => {
    expect(await failsWith(upsertPartnerService(actor, { serviceId: 's1', price: 40_000 }, APP_ORIGIN), 400)).toMatch(/precio base/)
    const row = await upsertPartnerService(actor, { serviceId: 's1' }, APP_ORIGIN)
    expect(row).toMatchObject({ price: 50_000, city: 'MEDELLIN', active: true, partnerId: 'p1' })
  })

  it('respeta min/max de la plataforma y la ciudad del enum', async () => {
    expect(await failsWith(upsertPartnerService(actor, { serviceId: 's1', price: 3_000_000 }, APP_ORIGIN), 400)).toMatch(/máximo/)
    expect(await failsWith(upsertPartnerService(actor, { serviceId: 's1', city: 'Pereira' }, APP_ORIGIN), 400)).toMatch(/Ciudad inválida/)
    await expect(upsertPartnerService(actor, { serviceId: 's1', city: 'Bogotá' }, APP_ORIGIN)).resolves.toMatchObject({ city: 'BOGOTA' })
    expect(parseCity('barranquilla')).toBe('BARRANQUILLA')
  })

  it('sexto servicio activo → 400; pausado sí se puede agregar', async () => {
    db.state.activeCount = MAX_ACTIVE_SERVICES
    expect(await failsWith(upsertPartnerService(actor, { serviceId: 's1' }, APP_ORIGIN), 400)).toMatch(/5 servicios/)
    await expect(upsertPartnerService(actor, { serviceId: 's1', active: false }, APP_ORIGIN)).resolves.toMatchObject({ active: false })
  })

  it('actualiza por partnerServiceId conservando precio y ciudad', async () => {
    db.state.existing = { id: 'ps1', partnerId: 'p1', serviceId: 's1', price: 80_000, city: 'CALI', active: true }
    const row = await upsertPartnerService(actor, { partnerServiceId: 'ps1' }, APP_ORIGIN)
    expect(row).toMatchObject({ price: 80_000, city: 'CALI', active: true })
    expect(db.prisma.partnerService.update).toHaveBeenCalled()
    db.state.existing = { id: 'ps1', partnerId: 'otro', serviceId: 's1', price: 80_000, city: 'CALI', active: true }
    await failsWith(upsertPartnerService(actor, { partnerServiceId: 'ps1' }, APP_ORIGIN), 404)
  })

  it('quien no es socio → 403', async () => {
    db.state.partner = null
    await failsWith(upsertPartnerService(actor, { serviceId: 's1' }, APP_ORIGIN), 403)
  })
})

describe('uploadDocument', () => {
  const file = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]), mime: 'image/jpeg', name: 'cedula.jpg' }
  it('tipo inválido → 400', async () => {
    expect(await failsWith(uploadDocument(actor, { type: 'SELFIE', file }, APP_ORIGIN), 400)).toMatch(/Tipo de documento inválido/)
    expect(db.prisma.verificationDocument.create).not.toHaveBeenCalled()
  })
  it('tipo válido sube y guarda el origen', async () => {
    const doc = await uploadDocument(actor, { type: 'cedula_ciudadania', file }, APP_ORIGIN)
    expect(doc).toMatchObject({ type: 'CEDULA_CIUDADANIA', origin: 'app', documentUrl: 'https://res.cloudinary.com/x/doc.jpg' })
  })
  it('archivo que no es imagen ni PDF → 400', async () => {
    await failsWith(uploadDocument(actor, { type: 'ANTECEDENTES', file: { buffer: Buffer.from('hola'), mime: 'text/plain', name: 'a.txt' } }, APP_ORIGIN), 400)
  })
})

describe('validateColombianBankAccount', () => {
  const bank = { accountNumberMinLength: 9, accountNumberMaxLength: 11 }
  const ok = { bankName: 'Bancolombia', accountType: 'SAVINGS', accountNumber: '1234567890', accountHolderName: 'Ana', holderDocumentType: 'CC', holderDocumentNumber: '1020304050' }
  it('acepta una cuenta válida', () => {
    expect(validateColombianBankAccount(ok, bank)).toBeNull()
    expect(validateColombianBankAccount({ ...ok, accountNumber: '123-456-7890' }, bank)).toBeNull()
  })
  it('banco, tipo, longitud, titular y documento', () => {
    expect(validateColombianBankAccount({ ...ok, bankName: ' ' }, bank)).toBe('Banco requerido')
    expect(validateColombianBankAccount(ok, null)).toMatch(/banco colombiano/)
    expect(validateColombianBankAccount({ ...ok, accountType: 'CDT' }, bank)).toBe('Tipo de cuenta inválido')
    expect(validateColombianBankAccount({ ...ok, accountNumber: '1234' }, bank)).toMatch(/entre 9 y 11/)
    expect(validateColombianBankAccount({ ...ok, accountHolderName: '' }, bank)).toBe('Titular requerido')
    expect(validateColombianBankAccount({ ...ok, holderDocumentType: 'TI' }, bank)).toBe('Tipo de documento inválido')
    expect(validateColombianBankAccount({ ...ok, holderDocumentNumber: '12' }, bank)).toBe('Número de documento inválido')
    expect(validateColombianBankAccount({ ...ok, holderDocumentType: 'PASSPORT', holderDocumentNumber: 'AB-1' }, bank)).toBe('Pasaporte inválido')
    expect(validateColombianBankAccount({ ...ok, holderDocumentType: 'PASSPORT', holderDocumentNumber: 'ab123456' }, bank)).toBeNull()
  })
})

describe('missingDocuments', () => {
  it('sin documentos faltan identidad y antecedentes', () => {
    expect(missingDocuments({ documents: [] }).map((m) => m.key)).toEqual(['IDENTIDAD', 'ANTECEDENTES'])
  })
  it('cualquier identidad PENDING o APPROVED cubre; los rechazados no cuentan', () => {
    expect(missingDocuments({ documents: [{ type: 'PASAPORTE', status: 'PENDING' }] }).map((m) => m.key)).toEqual(['ANTECEDENTES'])
    expect(missingDocuments({ documents: [{ type: 'CEDULA_CIUDADANIA', status: 'REJECTED' }, { type: 'ANTECEDENTES', status: 'APPROVED' }] }).map((m) => m.key)).toEqual(['IDENTIDAD'])
    expect(missingDocuments({ documents: [{ type: 'PEP', status: 'APPROVED' }, { type: 'ANTECEDENTES', status: 'PENDING' }, { type: 'DIPLOMA_TECNICO', status: 'PENDING' }] })).toEqual([])
  })
})

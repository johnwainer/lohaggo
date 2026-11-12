import { createHmac } from 'crypto'
import { describe, expect, it } from 'vitest'
import { buildMercadoPagoManifest, mercadoPagoIdsMatch, mercadoPagoTsMs, verifyMercadoPagoSignature } from '@/lib/payments/mp-signature'

const SECRET = 'test-webhook-secret'
const NOW = 1_700_000_100_000
const sign = (manifest: string, secret = SECRET) => createHmac('sha256', secret).update(manifest).digest('hex')

describe('firma del webhook de Mercado Pago', () => {
  it('el manifiesto usa el data.id del query string, no el request id', () => {
    expect(buildMercadoPagoManifest({ dataId: '123456', requestId: 'req-abc', ts: '1700000000' })).toBe('id:123456;request-id:req-abc;ts:1700000000;')
  })

  it('pasa a minúsculas el id alfanumérico y respeta el que no lo es', () => {
    expect(buildMercadoPagoManifest({ dataId: 'ABC123', requestId: 'r', ts: '1' })).toBe('id:abc123;request-id:r;ts:1;')
    expect(buildMercadoPagoManifest({ dataId: 'AB-12', requestId: 'r', ts: '1' })).toBe('id:AB-12;request-id:r;ts:1;')
  })

  it('omite la parte del id si no viene', () => {
    expect(buildMercadoPagoManifest({ dataId: null, requestId: 'r', ts: '1' })).toBe('request-id:r;ts:1;')
  })

  it('acepta una firma calculada con el manifiesto correcto (fixture)', () => {
    const ts = '1700000000'
    const v1 = sign(`id:98765432;request-id:7f3a-req;ts:${ts};`)
    expect(verifyMercadoPagoSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: '7f3a-req', dataId: '98765432', secret: SECRET, now: NOW })).toBe(true)
  })

  it('rechaza la firma que se calculó con el request id en lugar del data.id (el bug anterior)', () => {
    const ts = '1700000000'
    const v1 = sign(`id:7f3a-req;request-id:7f3a-req;ts:${ts};`)
    expect(verifyMercadoPagoSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: '7f3a-req', dataId: '98765432', secret: SECRET, now: NOW })).toBe(false)
  })

  it('rechaza secreto distinto, ts alterado, data.id alterado, formato inválido y falta de secreto', () => {
    const ts = '1700000000'
    const v1 = sign(`id:98765432;request-id:r1;ts:${ts};`)
    const base = { xSignature: `ts=${ts},v1=${v1}`, xRequestId: 'r1', dataId: '98765432', secret: SECRET, now: NOW }
    expect(verifyMercadoPagoSignature(base)).toBe(true)
    expect(verifyMercadoPagoSignature({ ...base, secret: 'otro' })).toBe(false)
    expect(verifyMercadoPagoSignature({ ...base, xSignature: `ts=1700000001,v1=${v1}` })).toBe(false)
    expect(verifyMercadoPagoSignature({ ...base, dataId: '11111111' })).toBe(false)
    expect(verifyMercadoPagoSignature({ ...base, xSignature: 'basura' })).toBe(false)
    expect(verifyMercadoPagoSignature({ ...base, xSignature: `ts=${ts},v1=abc` })).toBe(false)
    expect(verifyMercadoPagoSignature({ ...base, secret: undefined })).toBe(false)
    expect(verifyMercadoPagoSignature({ ...base, xRequestId: null })).toBe(false)
  })

  it('rechaza un ts de más de 10 minutos (repetición) y acepta ts en milisegundos', () => {
    const ts = '1700000000'
    const v1 = sign(`id:98765432;request-id:r1;ts:${ts};`)
    const base = { xSignature: `ts=${ts},v1=${v1}`, xRequestId: 'r1', dataId: '98765432', secret: SECRET }
    expect(verifyMercadoPagoSignature({ ...base, now: 1_700_000_000_000 + 9 * 60_000 })).toBe(true)
    expect(verifyMercadoPagoSignature({ ...base, now: 1_700_000_000_000 + 11 * 60_000 })).toBe(false)
    const tsMs = '1700000000000'
    const v1Ms = sign(`id:98765432;request-id:r1;ts:${tsMs};`)
    expect(verifyMercadoPagoSignature({ ...base, xSignature: `ts=${tsMs},v1=${v1Ms}`, now: 1_700_000_060_000 })).toBe(true)
    expect(mercadoPagoTsMs('1700000000')).toBe(1_700_000_000_000)
  })

  it('el data.id del cuerpo debe coincidir con el firmado', () => {
    expect(mercadoPagoIdsMatch('ABC123', 'abc123')).toBe(true)
    expect(mercadoPagoIdsMatch('98765432', 98765432)).toBe(true)
    expect(mercadoPagoIdsMatch('98765432', '11111111')).toBe(false)
    expect(mercadoPagoIdsMatch(null, '11111111')).toBe(false)
    expect(mercadoPagoIdsMatch('98765432', undefined)).toBe(true)
  })
})

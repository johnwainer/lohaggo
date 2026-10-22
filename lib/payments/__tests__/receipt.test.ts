import { describe, expect, it } from 'vitest'
import { paymentView, receiptOf, validReceiptUrl, withReceipt } from '@/lib/payments/receipt'

describe('Comprobante de transferencia', () => {
  it('solo acepta fotos de nuestro almacenamiento', () => {
    expect(validReceiptUrl('https://res.cloudinary.com/lohaggo/image/upload/a.jpg', 'lohaggo')).toBe('https://res.cloudinary.com/lohaggo/image/upload/a.jpg')
    expect(validReceiptUrl('https://res.cloudinary.com/otra/image/upload/a.jpg', 'lohaggo')).toBeNull()
    expect(validReceiptUrl('https://www.lohaggo.com/login')).toBeNull()
    expect(validReceiptUrl('javascript:alert(1)')).toBeNull()
    expect(validReceiptUrl('/uploads/requests/123-abc.jpg')).toBe('/uploads/requests/123-abc.jpg')
    expect(validReceiptUrl('http://res.cloudinary.com/a.jpg')).toBeNull()
    expect(validReceiptUrl('https://evil.com/a.jpg')).toBeNull()
    expect(validReceiptUrl('/uploads/../secret')).toBeNull()
    expect(validReceiptUrl(42)).toBeNull()
  })
  it('se guarda en metadata sin perder otras claves y nunca sale la metadata cruda', () => {
    const m = withReceipt('{"otra":1}', '/uploads/requests/a.jpg')
    expect(JSON.parse(m!)).toEqual({ otra: 1, receiptUrl: '/uploads/requests/a.jpg' })
    expect(receiptOf(m)).toBe('/uploads/requests/a.jpg')
    expect(receiptOf('no-json')).toBeNull()
    expect(withReceipt(m, null)).toBe('{"otra":1}')
    const v = paymentView({ id: 'p1', metadata: m })
    expect(v).toEqual({ id: 'p1', receiptUrl: '/uploads/requests/a.jpg' })
    expect('metadata' in v).toBe(false)
  })
})

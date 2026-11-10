import { describe, expect, it } from 'vitest'
import { extractLinkCode } from '@/lib/accounts/link-code'

describe('extractLinkCode', () => {
  it.each([
    ['511002', '511002'],
    [' 511002 ', '511002'],
    ['511 002', '511002'],
    ['511-002', '511002'],
    ['Mi código es 511002', '511002'],
    ['*511002*', '511002'],
    ['el código: 511.002 gracias', '511002'],
    ['511002 3001234567', '511002'],
  ])('%s → %s', (text, code) => expect(extractLinkCode(text)).toBe(code))

  it('no es un código', () => {
    expect(extractLinkCode('hola')).toBeNull()
    expect(extractLinkCode('12345')).toBeNull()
    expect(extractLinkCode('3001234567')).toBeNull()
  })
})

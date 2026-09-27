import { describe, expect, it } from 'vitest'
import { safeInternalPath, withRedirect } from '@/lib/navigation/safe-redirect'

describe('safeInternalPath', () => {
  it('acepta rutas internas con query', () => {
    expect(safeInternalPath('/servicios/plomeria?resume=1', '/dashboard')).toBe('/servicios/plomeria?resume=1')
    expect(safeInternalPath('/dashboard', '/x')).toBe('/dashboard')
  })
  it('rechaza URLs externas y trucos de origen', () => {
    for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', 'evil.com', '/%0d%0a', '\t//evil.com', '/foo\\bar']) {
      const out = safeInternalPath(bad, '/dashboard')
      expect(out === '/dashboard' || out.startsWith('/')).toBe(true)
      expect(out).not.toContain('evil.com')
    }
    expect(safeInternalPath('https://evil.com', '/dashboard')).toBe('/dashboard')
    expect(safeInternalPath('//evil.com/x', '/dashboard')).toBe('/dashboard')
    expect(safeInternalPath('/\\evil.com', '/dashboard')).toBe('/dashboard')
  })
  it('vacío o nulo usa el respaldo', () => {
    expect(safeInternalPath(null, '/dashboard')).toBe('/dashboard')
    expect(safeInternalPath('', '/dashboard')).toBe('/dashboard')
  })
})

describe('withRedirect', () => {
  it('codifica el destino con su propia query', () => {
    expect(withRedirect('/register', '/servicios/aseo?resume=1')).toBe('/register?redirect=%2Fservicios%2Faseo%3Fresume%3D1')
  })
  it('ignora destinos no seguros', () => {
    expect(withRedirect('/register', 'https://evil.com')).toBe('/register')
    expect(withRedirect('/register', null)).toBe('/register')
  })
})

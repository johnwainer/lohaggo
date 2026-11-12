import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JWT } from 'next-auth/jwt'
import { clearLiveUserCache, refreshTokenFromDb, TOKEN_RECHECK_MS } from '@/lib/auth-refresh'
import { resolveSecurityInternalToken } from '@/lib/security/internal-token'
import { sameSecret } from '@/lib/security/same-secret'

const NOW = 1_800_000_000_000
const token = (over: Partial<JWT> = {}): JWT => ({ sub: 'u1', role: 'ADMIN', isActive: true, ...over })

beforeEach(() => clearLiveUserCache())

describe('revalidación de la sesión contra la base de datos', () => {
  it('no consulta si el token se confirmó hace menos de 5 minutos', async () => {
    const load = vi.fn()
    const out = await refreshTokenFromDb(token({ checkedAt: NOW - 60_000 }), load, NOW)
    expect(load).not.toHaveBeenCalled()
    expect(out.role).toBe('ADMIN')
  })

  it('consulta cuando pasaron 5 minutos y toma el rol vigente (un admin degradado pierde el acceso)', async () => {
    const load = vi.fn(async () => ({ role: 'CLIENT', isActive: true }))
    const out = await refreshTokenFromDb(token({ checkedAt: NOW - TOKEN_RECHECK_MS - 1 }), load, NOW)
    expect(load).toHaveBeenCalledTimes(1)
    expect(out.role).toBe('CLIENT')
    expect(out.checkedAt).toBe(NOW)
    expect(out.invalid).toBe(false)
  })

  it('un usuario desactivado o borrado queda como inválido', async () => {
    const off = await refreshTokenFromDb(token(), async () => ({ role: 'ADMIN', isActive: false }), NOW)
    expect(off.invalid).toBe(true)
    clearLiveUserCache()
    const gone = await refreshTokenFromDb(token(), async () => null, NOW)
    expect(gone.invalid).toBe(true)
  })

  it('el caché de la instancia evita consultar de nuevo aunque el token siga viejo', async () => {
    const load = vi.fn(async () => ({ role: 'ADMIN', isActive: true }))
    await refreshTokenFromDb(token(), load, NOW)
    await refreshTokenFromDb(token(), load, NOW + 60_000)
    expect(load).toHaveBeenCalledTimes(1)
    await refreshTokenFromDb(token(), load, NOW + TOKEN_RECHECK_MS + 1)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('si la base de datos falla conserva el token en vez de cerrar sesiones', async () => {
    const t = token()
    const out = await refreshTokenFromDb(t, async () => { throw new Error('db down') }, NOW)
    expect(out).toBe(t)
  })
})

describe('token interno de seguridad', () => {
  it('proxy y endpoint usan la misma cadena de respaldo', () => {
    expect(resolveSecurityInternalToken({ SECURITY_INTERNAL_TOKEN: 'a', NEXTAUTH_SECRET: 'b' })).toBe('a')
    expect(resolveSecurityInternalToken({ NEXTAUTH_SECRET_CURRENT: 'c', NEXTAUTH_SECRET: 'b' })).toBe('c')
    expect(resolveSecurityInternalToken({ NEXTAUTH_SECRET: 'b' })).toBe('b')
    expect(resolveSecurityInternalToken({})).toBeUndefined()
  })

  it('sameSecret compara en tiempo constante y falla sin secreto', () => {
    expect(sameSecret('abc', 'abc')).toBe(true)
    expect(sameSecret('abc', 'abd')).toBe(false)
    expect(sameSecret('abc', 'abcd')).toBe(false)
    expect(sameSecret(null, 'abc')).toBe(false)
    expect(sameSecret('abc', undefined)).toBe(false)
    expect(sameSecret('', '')).toBe(false)
  })
})

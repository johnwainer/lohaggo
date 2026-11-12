import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ destroy: vi.fn(), enabled: vi.fn(() => true) }))
vi.mock('@/lib/cloudinary', () => ({ cloudinaryService: { destroy: m.destroy, isEnabled: m.enabled, cloudName: () => 'lohaggo' } }))

import { assetFromUrl, deleteAssets, notesWithPending, parseAssetRef, pendingFromNotes } from '../assets'

beforeEach(() => { vi.clearAllMocks(); m.enabled.mockReturnValue(true) })

describe('assetFromUrl', () => {
  it('saca el id de una URL propia, con transformaciones y versión', () => {
    expect(assetFromUrl('https://res.cloudinary.com/lohaggo/image/upload/c_fill,w_200/v123/lohaggo/docs/a.jpg', null, 'lohaggo')).toBe('image:lohaggo/docs/a')
    expect(assetFromUrl('https://res.cloudinary.com/lohaggo/video/upload/v1/x/y.mp4', null, 'lohaggo')).toBe('video:x/y')
  })
  it('los archivos raw conservan la extensión', () => {
    expect(assetFromUrl('https://res.cloudinary.com/lohaggo/raw/upload/v1/docs/cedula.pdf', null, 'lohaggo')).toBe('raw:docs/cedula.pdf')
  })
  it('el publicId guardado manda sobre la URL', () => {
    expect(assetFromUrl('https://res.cloudinary.com/lohaggo/image/upload/v1/a.jpg', 'lohaggo/real', 'lohaggo')).toBe('image:lohaggo/real')
  })
  it('ignora lo que no es de la nube propia', () => {
    expect(assetFromUrl('https://res.cloudinary.com/otra/image/upload/v1/a.jpg', null, 'lohaggo')).toBeNull()
    expect(assetFromUrl('https://api.twilio.com/media/1', null, 'lohaggo')).toBeNull()
    expect(assetFromUrl('', null, 'lohaggo')).toBeNull()
    expect(assetFromUrl('https://res.cloudinary.com/lohaggo/image/upload/v1/a.jpg', null, null)).toBeNull()
  })
  it('parseAssetRef valida el tipo', () => {
    expect(parseAssetRef('raw:a/b.pdf')).toEqual({ type: 'raw', publicId: 'a/b.pdf' })
    expect(parseAssetRef('zip:a')).toBeNull()
  })
})

describe('deleteAssets', () => {
  it('cuenta borrados, ya inexistentes y fallidos; solo los fallidos quedan pendientes', async () => {
    m.destroy.mockResolvedValueOnce('ok').mockResolvedValueOnce('not found').mockRejectedValueOnce(new Error('boom'))
    const r = await deleteAssets(['image:a', 'raw:b.pdf', 'video:c', 'image:a'])
    expect(r).toMatchObject({ deleted: 1, notFound: 1, failed: 1, pending: ['video:c'] })
    expect(m.destroy).toHaveBeenCalledWith('b.pdf', 'raw')
    expect(m.destroy).toHaveBeenCalledTimes(3)
  })
  it('un reintento solo toca lo pendiente', async () => {
    m.destroy.mockResolvedValue('ok')
    const r = await deleteAssets(['video:c'])
    expect(r).toMatchObject({ deleted: 1, failed: 0, pending: [] })
    expect(m.destroy).toHaveBeenCalledTimes(1)
  })
  it('sin proveedor configurado todo queda pendiente y no lanza', async () => {
    m.enabled.mockReturnValue(false)
    const r = await deleteAssets(['image:a'])
    expect(r).toMatchObject({ failed: 1, pending: ['image:a'] })
    expect(m.destroy).not.toHaveBeenCalled()
  })
  it('lista vacía no hace nada', async () => {
    expect(await deleteAssets([])).toMatchObject({ deleted: 0, failed: 0, pending: [] })
  })
})

describe('notas con pendientes', () => {
  it('guarda, lee y limpia la línea de pendientes', () => {
    const n = notesWithPending('Cuenta anonimizada.', ['image:a', 'raw:b.pdf'])
    expect(pendingFromNotes(n)).toEqual(['image:a', 'raw:b.pdf'])
    expect(notesWithPending(n, ['raw:b.pdf'])).toBe('Cuenta anonimizada.\n[archivos-pendientes] ["raw:b.pdf"]')
    expect(notesWithPending(n, [])).toBe('Cuenta anonimizada.')
    expect(pendingFromNotes('sin marca')).toEqual([])
  })
})

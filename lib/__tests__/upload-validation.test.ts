import { describe, expect, it } from 'vitest'
import { validateUploadedImage } from '@/lib/file-validation'

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]
const JPG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]
const mk = (bytes: number[], name: string, type: string) => new File([new Uint8Array(bytes)], name, { type })

describe('validación de fotos por magic bytes', () => {
  it('acepta un PNG real y devuelve el tipo detectado con un nombre neutro', async () => {
    const r = await validateUploadedImage(mk(PNG, 'foto.exe', 'application/octet-stream'))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.mimeType).toBe('image/png')
      expect(r.file.type).toBe('image/png')
      expect(r.file.name).toBe('photo.png')
    }
  })

  it('ignora el tipo y la extensión que declara el navegador', async () => {
    const asJpegByName = await validateUploadedImage(mk(PNG, 'a.jpg', 'image/jpeg'))
    expect(asJpegByName.ok && asJpegByName.mimeType).toBe('image/png')
    const jpg = await validateUploadedImage(mk(JPG, 'a.png', 'image/png'))
    expect(jpg.ok && jpg.file.name).toBe('photo.jpg')
  })

  it('rechaza un archivo que dice ser imagen pero no lo es', async () => {
    const html = new TextEncoder().encode('<script>alert(1)</script>')
    const r = await validateUploadedImage(mk(Array.from(html), 'x.png', 'image/png'))
    expect(r.ok).toBe(false)
  })

  it('rechaza PDFs, aunque otras rutas los acepten', async () => {
    const r = await validateUploadedImage(mk(PDF, 'x.pdf', 'application/pdf'))
    expect(r.ok).toBe(false)
  })

  it('rechaza vacíos y los que superan 10 MB', async () => {
    expect((await validateUploadedImage(mk([], 'a.png', 'image/png'))).ok).toBe(false)
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })
    expect((await validateUploadedImage(big)).ok).toBe(false)
  })
})

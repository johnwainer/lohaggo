import { describe, expect, it } from 'vitest'
import { aspectFor, brandedUrl, clampCount, defaultOrientation, finalPrompt, fromPexels, isPexelsImageUrl } from '@/lib/marketing/images-core'
import { deliveryUrl } from '@/lib/marketing/media'
import { userPrompt } from '@/lib/marketing/copilot-core'

const kit = { logoPublicId: 'lohaggo/marketing/ws/marca/logo', logoPosition: 'south_east', logoScale: 0.18, logoOpacity: 90, logoMargin: 24 }
const img = 'https://res.cloudinary.com/demo/image/upload/v1/lohaggo/marketing/ws/p1/foto.jpg'

describe('logo sobre la imagen (Cloudinary)', () => {
  it('capa con el logo real, posición, tamaño, opacidad y margen', () => {
    expect(brandedUrl(img, kit)).toBe('https://res.cloudinary.com/demo/image/upload/l_lohaggo:marketing:ws:marca:logo,fl_relative,w_0.18,o_90/fl_layer_apply,g_south_east,x_24,y_24/v1/lohaggo/marketing/ws/p1/foto.jpg')
  })
  it('acota valores y posición inválida', () => {
    const u = brandedUrl(img, { ...kit, logoPosition: 'centro', logoScale: 3, logoOpacity: 0, logoMargin: -5 })!
    expect(u).toContain('w_0.5,o_90')
    expect(u).toContain('g_south_east,x_0,y_0')
  })
  it('sin logo o fuera de Cloudinary no hace nada', () => {
    expect(brandedUrl(img, { ...kit, logoPublicId: null })).toBeNull()
    expect(brandedUrl('https://images.pexels.com/photos/1/a.jpeg', kit)).toBeNull()
    expect(brandedUrl('https://res.cloudinary.com/demo/video/upload/v1/a.mp4', kit)).toBeNull()
  })
  it('cada red recibe la imagen ajustada y con el logo', () => {
    const branded = brandedUrl(img, kit)!
    const ig = deliveryUrl('INSTAGRAM', branded, { kind: 'image', width: 1080, height: 1350 })
    // resize first, then the logo relative to the resized image
    expect(ig.indexOf('c_limit,w_1440')).toBeLessThan(ig.indexOf('l_lohaggo'))
    expect(ig.endsWith('/foto.jpg')).toBe(true)
  })
})

describe('Pexels', () => {
  const photo = {
    id: 3964341, width: 4000, height: 5000, url: 'https://www.pexels.com/photo/3964341/', alt: 'Plomero reparando un lavamanos',
    photographer: 'Ana Pérez', photographer_url: 'https://www.pexels.com/@ana',
    src: { original: 'https://images.pexels.com/photos/3964341/pexels-photo-3964341.jpeg', large2x: '', large: 'https://images.pexels.com/l.jpeg', medium: 'https://images.pexels.com/m.jpeg' },
  }
  it('crédito del fotógrafo y versión grande comprimida', () => {
    expect(fromPexels(photo)).toEqual({
      source: 'pexels', id: 'pexels:3964341', previewUrl: 'https://images.pexels.com/m.jpeg',
      fullUrl: 'https://images.pexels.com/photos/3964341/pexels-photo-3964341.jpeg?auto=compress&cs=tinysrgb&w=2000',
      width: 4000, height: 5000, alt: 'Plomero reparando un lavamanos', credit: 'Foto de Ana Pérez en Pexels', creditUrl: 'https://www.pexels.com/@ana',
    })
  })
  it('solo se importan imágenes del CDN de Pexels', () => {
    expect(isPexelsImageUrl('https://images.pexels.com/photos/1/a.jpeg')).toBe(true)
    expect(isPexelsImageUrl('https://evil.com/images.pexels.com/a.jpeg')).toBe(false)
    expect(isPexelsImageUrl('http://images.pexels.com/a.jpeg')).toBe(false)
  })
})

describe('generación', () => {
  it('formato según el canal', () => {
    expect(defaultOrientation('INSTAGRAM', null)).toBe('portrait')
    expect(defaultOrientation('FACEBOOK', null)).toBe('landscape')
    expect(defaultOrientation('WEB', null)).toBe('landscape')
    expect(aspectFor('portrait')).toMatchObject({ ratio: '4:5', openaiSize: '1024x1536' })
    expect(aspectFor('square').ratio).toBe('1:1')
  })
  it('la instrucción final siempre prohíbe textos y logos dibujados', () => {
    const p = finalPrompt('Técnico revisando un techo', { style: 'fotografía realista', orientation: 'portrait', withReference: true })
    expect(p).toContain('Técnico revisando un techo')
    expect(p).toContain('Estilo: fotografía realista.')
    expect(p).toContain('referencia')
    expect(p).toContain('Formato 4:5')
    expect(p).toContain('No incluyas textos, letras, marcas de agua ni logotipos')
  })
  it('entre 1 y 4 imágenes por pedido', () => {
    expect(clampCount(10)).toBe(4)
    expect(clampCount(0)).toBe(1)
    expect(clampCount('x')).toBe(2)
  })
  it('Claude propone búsquedas en inglés y una descripción', () => {
    const p = userPrompt({ action: 'images', channel: 'INSTAGRAM', text: 'Revisa tu techo antes de las lluvias' })
    expect(p).toContain('EN INGLÉS')
    expect(p).toContain('"prompt"')
    expect(p).toContain('Revisa tu techo')
  })
})

import { matchServices, servicePrompt } from '@/lib/marketing/images-core'

describe('sugerencias por servicio del catálogo', () => {
  const catalog = ['Plomería', 'Cerrajería', 'Electricidad', 'Limpieza de hogar', 'Pintura', 'Carpintería']
  it('reconoce el servicio en el título aunque se escriba como oficio', () => {
    expect(matchServices('Cerrajería en Medellín: guía práctica', '', catalog)[0]).toBe('Cerrajería')
    expect(matchServices('¿Buscas un plomero de confianza?', '', catalog)[0]).toBe('Plomería')
    expect(matchServices('Consejos de un electricista', '', catalog)[0]).toBe('Electricidad')
  })
  it('el título pesa más que el texto', () => {
    expect(matchServices('Pintura para tu sala', 'Después de pintar, llama a limpieza de hogar', catalog)).toEqual(['Pintura', 'Limpieza de hogar'])
  })
  it('sin coincidencias no inventa', () => {
    expect(matchServices('Feliz navidad', 'Les deseamos lo mejor', catalog)).toEqual([])
  })
  it('descripción por defecto para generar', () => {
    expect(servicePrompt('Cerrajería')).toBe('Profesional de cerrajería trabajando en un hogar colombiano, escena real y cercana.')
  })
})

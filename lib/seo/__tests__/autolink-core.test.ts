import { describe, expect, it } from 'vitest'
import { autoLinkMarkdown, buildRules, fold, MAX_AUTO_LINKS, type LinkContext } from '@/lib/seo/autolink-core'

const ctx: LinkContext = {
  services: [{ slug: 'plomeria', name: 'Plomería' }, { slug: 'electricidad', name: 'Electricidad' }, { slug: 'pintura', name: 'Pintura' }],
  ownServiceSlug: 'plomeria',
  priceSlugs: ['plomeria', 'electricidad'],
  zones: [{ key: 'laureles', name: 'Laureles' }, { key: 'poblado', name: 'El Poblado' }],
  zonePath: (s: string, z: string) => `/servicios/${s}/${z}`,
}
const link = (body: string, c = ctx, max?: number) => autoLinkMarkdown(body, buildRules(c), { max })

describe('enlaces internos automáticos', () => {
  it('enlaza la primera mención del servicio y del oficio, con plural y sin importar tildes', () => {
    const out = link('Un plomero resuelve la fuga. Los plomeros cobran distinto.')
    expect(out).toContain('[plomero](/servicios/plomeria)')
    expect(out.match(/\(\/servicios\/plomeria\)/g)).toHaveLength(1)
  })

  it('conserva mayúsculas y tildes del texto original', () => {
    expect(link('La Plomería es clave en casa.')).toContain('[Plomería](/servicios/plomeria)')
  })

  it('no enlaza dentro de títulos, código, enlaces, imágenes ni URLs', () => {
    const body = ['## Cuándo llamar a un plomero', '', '`plomero` en código', '', '[mi plomero](https://otro.com/plomero)', '', '![plomero](/img.png)', '', 'https://x.com/plomero', '', '```', 'plomero', '```'].join('\n')
    expect(link(body)).toBe(body)
  })

  it('respeta lo que el autor ya enlazó: no lo repite', () => {
    const body = 'Mira el [servicio de plomería](/servicios/plomeria). También un plomero a domicilio.'
    expect(link(body)).toBe(body)
  })

  it('no enlaza partes de otra palabra', () => {
    expect(link('Una plomeríaz inventada y electricidadera rara.')).not.toContain('](')
  })

  it('enlaza el precio de referencia al precio del servicio del artículo', () => {
    expect(link('El precio de referencia depende del trabajo.')).toContain('[precio de referencia](/precios/plomeria)')
  })

  it('enlaza las zonas del servicio del artículo', () => {
    expect(link('Trabajo mucho en Laureles y El Poblado.')).toContain('[Laureles](/servicios/plomeria/laureles)')
  })

  it('el servicio del artículo va antes que los demás y hay tope de enlaces', () => {
    const body = 'Electricidad y pintura y plomería, precio de referencia, Laureles, El Poblado, índice de precios.'
    const out = link(body)
    expect(out.match(/\]\(\//g)!.length).toBeLessThanOrEqual(MAX_AUTO_LINKS)
    expect(out).toContain('(/servicios/plomeria)')
    expect(link(body, ctx, 2).match(/\]\(\//g)).toHaveLength(2)
  })

  it('sin servicio conocido enlaza los demás servicios y el precio general', () => {
    const out = link('El electricista y el precio de referencia.', { ...ctx, ownServiceSlug: null })
    expect(out).toContain('[electricista](/servicios/electricidad)')
    expect(out).toContain('[precio de referencia](/precios)')
  })

  it('fold conserva el largo', () => {
    expect(fold('Plomería Ñandú')).toHaveLength('Plomería Ñandú'.length)
    expect(fold('Plomería')).toBe('plomeria')
  })
})

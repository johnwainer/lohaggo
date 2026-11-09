import { describe, expect, it } from 'vitest'
import {
  archivedKeys,
  assetKey,
  buildLibrary,
  downloadUrl,
  filterLibrary,
  formatFit,
  orientationOf,
  pickReusable,
  rankPieces,
  readCandidate,
  reeditionTitle,
  type CandidateRow,
  type MediaRow,
  type PostInfo,
} from '@/lib/marketing/library-core'
import { defaultAgentConfig, sanitizeAgentConfig, readAgentConfig } from '@/lib/marketing/agent-input'
import { deliveryUrl, isAiSource, mediaOrigin } from '@/lib/marketing/media'

const CDN = 'https://res.cloudinary.com/demo/image/upload'
const d = (s: string) => new Date(`${s}T12:00:00Z`)

const media = (o: Partial<MediaRow> & { id: string; postId: string }): MediaRow => ({
  url: `${CDN}/v1/lohaggo/marketing/ws/${o.postId}/${o.id}.jpg`, originalUrl: null, publicId: `lohaggo/marketing/ws/${o.postId}/${o.id}`, kind: 'image', source: 'ai',
  alt: null, width: 1024, height: 1536, durationSec: null, credit: 'Generada con OpenAI', creditUrl: null, createdAt: d('2026-09-01'), ...o,
})
const post = (o: Partial<PostInfo> & { id: string }): PostInfo => ({ title: `Post ${o.id}`, status: 'published', pillar: 'educar', service: 'Plomería', style: 'profesional', publishedAt: d('2026-09-02'), createdAt: d('2026-09-01'), result: null, ...o })
const candidate = (o: Partial<CandidateRow> & { id: string; publicId: string }): CandidateRow => ({
  postId: 'p1', createdAt: d('2026-09-01'), url: `${CDN}/v1/${o.publicId}.png`, width: 1024, height: 1536, bytes: 1000, prompt: 'Plomero arreglando un lavamanos', style: null, orientation: 'portrait', service: 'Plomería', credit: 'Generada con OpenAI', ...o,
})

describe('biblioteca: un recurso por archivo', () => {
  it('la misma imagen en dos publicaciones (con y sin logo) es un solo recurso con 2 usos', () => {
    const shared = 'lohaggo/marketing/ws/p1/ia/a'
    const lib = buildLibrary({
      media: [
        media({ id: 'm1', postId: 'p1', publicId: shared, url: `${CDN}/l_logo/v1/${shared}.png`, originalUrl: `${CDN}/v1/${shared}.png`, createdAt: d('2026-09-01') }),
        media({ id: 'm2', postId: 'p2', publicId: shared, url: `${CDN}/v1/${shared}.png`, source: 'library-ai', createdAt: d('2026-10-01') }),
      ],
      candidates: [candidate({ id: 'c1', publicId: shared })],
      posts: [post({ id: 'p1', publishedAt: d('2026-09-02'), result: { reach: 900, webViews: 0, engagementRate: 4.2 } }), post({ id: 'p2', publishedAt: d('2026-10-03'), result: { reach: 100, webViews: 0, engagementRate: 1 } })],
      archived: new Set(),
    })
    expect(lib).toHaveLength(1)
    const a = lib[0]
    expect(a.uses).toBe(2)
    expect(a.origin).toBe('ai')
    expect(a.url).toBe(`${CDN}/v1/${shared}.png`)
    expect(a.candidate).toBe(true)
    expect(a.firstUsedAt?.slice(0, 10)).toBe('2026-09-02')
    expect(a.lastUsedAt?.slice(0, 10)).toBe('2026-10-03')
    expect(a.best?.postId).toBe('p1')
    expect(a.services).toEqual(['Plomería'])
    expect(a.styles).toEqual(['Profesional'])
  })
  it('las opciones de IA que nadie eligió quedan «sin usar» con su descripción', () => {
    const lib = buildLibrary({ media: [], candidates: [candidate({ id: 'c1', publicId: 'x/ia/b' })], posts: [post({ id: 'p1' })], archived: new Set() })
    expect(lib[0]).toMatchObject({ uses: 0, candidate: true, prompt: 'Plomero arreglando un lavamanos', orientation: 'portrait', origin: 'ai' })
  })
  it('un video hecho de una foto no es otro recurso', () => {
    const lib = buildLibrary({ media: [media({ id: 'm1', postId: 'p1' }), media({ id: 'v1', postId: 'p1', kind: 'video', publicId: null, url: `${CDN}/v1/lohaggo/marketing/ws/p1/m1.jpg` })], candidates: [], posts: [post({ id: 'p1' })], archived: new Set() })
    expect(lib).toHaveLength(1)
    expect(lib[0].kind).toBe('image')
  })
  it('clave por public id o, sin él, por la URL original sin parámetros', () => {
    expect(assetKey({ publicId: 'a/b', url: 'x' })).toBe('pid:a/b')
    expect(assetKey({ publicId: null, originalUrl: 'https://x/a.jpg?w=2', url: 'https://x/l_logo/a.jpg' })).toBe('url:https://x/a.jpg')
  })
  it('orientación y formatos donde sirve', () => {
    expect(orientationOf(1024, 1536)).toBe('portrait')
    expect(orientationOf(1000, 1000)).toBe('square')
    expect(orientationOf(1536, 1024)).toBe('landscape')
    expect(orientationOf(null, 10)).toBeNull()
    expect(formatFit(1024, 1536)).toEqual(['feed', 'vertical'])
    expect(formatFit(1080, 1920)).toEqual(['vertical'])
    expect(formatFit(1536, 1024)).toEqual(['landscape'])
  })
  it('descargar pide el archivo a Cloudinary como adjunto', () => {
    expect(downloadUrl(`${CDN}/v1/a.png`)).toBe(`${CDN}/fl_attachment/v1/a.png`)
    expect(downloadUrl('https://images.pexels.com/a.jpg')).toBe('https://images.pexels.com/a.jpg')
  })
})

describe('biblioteca: filtros y archivo', () => {
  const lib = buildLibrary({
    media: [
      media({ id: 'm1', postId: 'p1', alt: 'Plomero en la cocina' }),
      media({ id: 'm2', postId: 'p2', source: 'pexels', width: 1600, height: 900, credit: 'Foto de Ana en Pexels' }),
      media({ id: 'v1', postId: 'p2', kind: 'video', source: 'pexels', url: 'https://res.cloudinary.com/demo/video/upload/v1/clip.mp4', publicId: 'clip', width: 1080, height: 1920 }),
    ],
    candidates: [candidate({ id: 'c1', publicId: 'free', service: 'Electricidad', postId: 'p3' })],
    posts: [post({ id: 'p1' }), post({ id: 'p2', service: 'Cerrajería', title: 'Cerrajero 24 h' }), post({ id: 'p3', service: 'Electricidad' })],
    archived: new Set(['pid:clip']),
  })
  it('tipo, origen, orientación, servicio y uso', () => {
    expect(filterLibrary(lib, { kind: 'image' })).toHaveLength(3)
    expect(filterLibrary(lib, { origin: 'pexels' }).map((a) => a.publicId)).toEqual(['lohaggo/marketing/ws/p2/m2'])
    expect(filterLibrary(lib, { orientation: 'landscape' })).toHaveLength(1)
    expect(filterLibrary(lib, { service: 'electricidad' }).map((a) => a.publicId)).toEqual(['free'])
    expect(filterLibrary(lib, { usage: 'unused' }).map((a) => a.publicId)).toEqual(['free'])
    expect(filterLibrary(lib, { usage: 'used' })).toHaveLength(2)
  })
  it('búsqueda por texto en alt, servicio, título y descripción, sin tildes', () => {
    expect(filterLibrary(lib, { q: 'cocina' })).toHaveLength(1)
    expect(filterLibrary(lib, { q: 'cerrajeria' })).toHaveLength(1)
    expect(filterLibrary(lib, { q: 'lavamanos' })).toHaveLength(1)
  })
  it('los archivados solo se ven al pedirlos', () => {
    expect(filterLibrary(lib, {}).some((a) => a.publicId === 'clip')).toBe(false)
    expect(filterLibrary(lib, { archived: true }).map((a) => a.publicId)).toEqual(['clip'])
  })
  it('la última marca de archivo gana', () => {
    const set = archivedKeys([{ details: '{"key":"a","archived":true}' }, { details: '{"key":"b","archived":true}' }, { details: '{"key":"a","archived":false}' }, { details: 'x' }])
    expect(Array.from(set)).toEqual(['b'])
  })
  it('lee candidatos del registro y descarta lo que no es de Cloudinary', () => {
    const row = readCandidate({ id: 'l1', entityId: 'p1', createdAt: d('2026-09-01'), details: JSON.stringify({ ws: 'w', url: `${CDN}/v1/a.png`, publicId: 'a', width: 1024, height: 1536, prompt: 'p', style: 's', orientation: 'portrait', service: 'Plomería' }) })
    expect(row).toMatchObject({ postId: 'p1', publicId: 'a', width: 1024, service: 'Plomería' })
    expect(readCandidate({ id: 'l2', entityId: 'p1', createdAt: d('2026-09-01'), details: JSON.stringify({ url: 'https://evil.example/a.png' }) })).toBeNull()
    expect(readCandidate({ id: 'l3', entityId: null, createdAt: d('2026-09-01'), details: '{' })).toBeNull()
  })
})

describe('reutilización del agente', () => {
  const now = d('2026-11-09')
  const lib = buildLibrary({
    media: [
      // used 10 days ago: rests
      media({ id: 'recent', postId: 'p1' }),
      // used 100 days ago, good result
      media({ id: 'good', postId: 'p2' }),
      // used 100 days ago, weak result
      media({ id: 'weak', postId: 'p3' }),
      // landscape: wrong orientation
      media({ id: 'wide', postId: 'p2', width: 1536, height: 1024 }),
    ],
    candidates: [
      candidate({ id: 'c-old', publicId: 'unused-old', createdAt: d('2026-08-01') }),
      candidate({ id: 'c-new', publicId: 'unused-new', createdAt: d('2026-10-01') }),
      candidate({ id: 'c-other', publicId: 'other-service', service: 'Pintura', postId: 'p9' }),
    ],
    posts: [
      post({ id: 'p1', publishedAt: d('2026-10-30') }),
      post({ id: 'p2', publishedAt: d('2026-07-31'), result: { reach: 5000, webViews: 0, engagementRate: 5 } }),
      post({ id: 'p3', publishedAt: d('2026-07-31'), result: { reach: 50, webViews: 0, engagementRate: 1 } }),
      post({ id: 'p9', service: 'Pintura' }),
    ],
    archived: new Set(),
  })
  const keys = (xs: Array<{ publicId: string | null }>) => xs.map((x) => x.publicId?.split('/').pop())

  it('primero las de IA sin usar (la más nueva), luego las de mejor resultado; nunca las usadas hace poco', () => {
    const got = pickReusable(lib, { service: 'Plomería', orientation: 'portrait', n: 10, afterDays: 45, now })
    expect(keys(got)).toEqual(['unused-new', 'unused-old', 'good', 'weak'])
  })
  it('respeta los días de descanso configurados', () => {
    expect(keys(pickReusable(lib, { service: 'Plomería', orientation: 'portrait', n: 10, afterDays: 5, now }))).toContain('recent')
    expect(keys(pickReusable(lib, { service: 'Plomería', orientation: 'portrait', n: 10, afterDays: 120, now }))).toEqual(['unused-new', 'unused-old'])
  })
  it('solo el mismo servicio y la orientación pedida; cuántas pide la pieza', () => {
    expect(keys(pickReusable(lib, { service: 'plomeria', orientation: 'landscape', n: 3, afterDays: 45, now }))).toEqual(['wide'])
    expect(keys(pickReusable(lib, { service: 'Pintura', orientation: 'portrait', n: 3, afterDays: 45, now }))).toEqual(['other-service'])
    expect(pickReusable(lib, { service: 'Plomería', orientation: 'portrait', n: 1, afterDays: 45, now })).toHaveLength(1)
    expect(pickReusable(lib, { service: null, orientation: 'portrait', n: 3, afterDays: 45, now })).toEqual([])
  })
  it('nunca archivadas ni las que ya tiene la pieza', () => {
    const archived = buildLibrary({ media: [], candidates: [candidate({ id: 'c', publicId: 'z' })], posts: [], archived: new Set(['pid:z']) })
    expect(pickReusable(archived, { service: 'Plomería', orientation: 'portrait', n: 3, afterDays: 45, now })).toEqual([])
    expect(keys(pickReusable(lib, { service: 'Plomería', orientation: 'portrait', n: 10, afterDays: 45, now, excludePostId: 'p2' }))).not.toContain('good')
  })
})

describe('configuración de reutilización del agente', () => {
  it('por defecto: solo como respaldo, 45 días', () => {
    expect(defaultAgentConfig().images.reuse).toEqual({ mode: 'fallback', afterDays: 45 })
    expect(readAgentConfig({ images: { source: 'ai', logo: true } }).images.reuse).toEqual({ mode: 'fallback', afterDays: 45 })
  })
  it('acota modo y días, y conserva lo anterior si no viene', () => {
    const base = defaultAgentConfig()
    expect(sanitizeAgentConfig({ images: { reuse: { mode: 'prefer', afterDays: 30 } } }, base).images.reuse).toEqual({ mode: 'prefer', afterDays: 30 })
    expect(sanitizeAgentConfig({ images: { reuse: { mode: 'siempre', afterDays: 2 } } }, base).images.reuse).toEqual({ mode: 'fallback', afterDays: 7 })
    expect(sanitizeAgentConfig({ images: { reuse: { afterDays: 9999 } } }, base).images.reuse.afterDays).toBe(365)
    const prev = sanitizeAgentConfig({ images: { reuse: { mode: 'never', afterDays: 60 } } }, base)
    expect(sanitizeAgentConfig({ images: { logo: false } }, prev).images.reuse).toEqual({ mode: 'never', afterDays: 60 })
  })
})

describe('origen de un archivo copiado de la biblioteca', () => {
  it('library-ai sigue siendo IA (etiqueta de Meta y recorte 4:5)', () => {
    expect(mediaOrigin('library-ai')).toBe('ai')
    expect(mediaOrigin('library-pexels')).toBe('pexels')
    expect(mediaOrigin(null)).toBe('upload')
    expect(isAiSource('library-ai')).toBe(true)
    expect(isAiSource('library-upload')).toBe(false)
    const url = `${CDN}/v1/a.png`
    expect(deliveryUrl('INSTAGRAM', url, { kind: 'image', width: 1024, height: 1536, source: 'library-ai' })).toContain('c_fill,g_auto,ar_4:5')
    expect(deliveryUrl('INSTAGRAM', url, { kind: 'image', width: 1024, height: 1536, source: 'library-upload' })).toContain('c_pad,ar_4:5')
  })
})

describe('piezas que funcionaron', () => {
  it('reservas, luego solicitudes, luego alcance e interacción', () => {
    const rows = [
      { id: 'a', bookings: 0, requests: 0, reach: 9000, webViews: 0, engagementRate: 9 },
      { id: 'b', bookings: 1, requests: 1, reach: 10, webViews: 0, engagementRate: 1 },
      { id: 'c', bookings: 0, requests: 3, reach: 10, webViews: 0, engagementRate: 1 },
      { id: 'd', bookings: 0, requests: 0, reach: 9000, webViews: 0, engagementRate: 2 },
    ]
    expect(rankPieces(rows).map((r) => r.id)).toEqual(['b', 'c', 'a', 'd'])
  })
  it('título de la reedición', () => {
    expect(reeditionTitle('Fugas en casa')).toBe('Fugas en casa (reedición)')
    expect(reeditionTitle('Fugas en casa (reedición)')).toBe('Fugas en casa (reedición)')
    expect(reeditionTitle('x'.repeat(200))).toHaveLength(200)
  })
})

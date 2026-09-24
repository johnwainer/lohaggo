import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { countHashtags, countMentions, instagramFormat, validateVariant, type VariantInput } from '@/lib/marketing/channel-rules'
import { articleJsonLd, jsonLdScript, makeExcerpt, readingMinutes, renderMarkdown, safeUrl, slugify, stripMarkdown } from '@/lib/marketing/seo'
import { deliveryUrl, ogImageUrl, videoPosterUrl } from '@/lib/marketing/media'
import { aggregatePostStatus, canSchedule, classifyGraphError, findAlreadyPublished, latestPerTarget, metricsDue, nextAttemptAt } from '@/lib/marketing/publisher-core'
import { sanitizeCampaignInput, sanitizePostInput, sanitizeVariantInput, validateUploadedMedia } from '@/lib/marketing/input'
import { parseHashtags, parseJson, systemPrompt, userPrompt } from '@/lib/marketing/copilot-core'
import { resolveMarketingGrants } from '@/lib/marketing/permissions'
import { RENEW_BEFORE_MS, shouldRenew } from '@/lib/marketing/token-health'

const MB = 1024 * 1024
const v = (over: Partial<VariantInput> = {}): VariantInput => ({ body: 'Hola', media: [], ...over })
const img = (over = {}) => ({ kind: 'image' as const, mime: 'image/jpeg', bytes: MB, width: 1080, height: 1350, ...over })
const vid = (over = {}) => ({ kind: 'video' as const, mime: 'video/mp4', bytes: 20 * MB, width: 1080, height: 1920, durationSec: 30, ...over })
const codes = (r: ReturnType<typeof validateVariant>) => ({ errors: r.errors.map((e) => e.code), warnings: r.warnings.map((e) => e.code) })

describe('Instagram: límites de la API', () => {
  it('texto, hashtags y menciones', () => {
    expect(codes(validateVariant('INSTAGRAM', v({ body: 'a'.repeat(2201), media: [img()] }))).errors).toContain('caption_length')
    expect(validateVariant('INSTAGRAM', v({ body: 'a'.repeat(2200), media: [img()] })).ok).toBe(true)
    const tags = Array.from({ length: 31 }, (_, i) => `#tag${i}`).join(' ')
    expect(codes(validateVariant('INSTAGRAM', v({ body: tags, media: [img()] }))).errors).toContain('hashtags')
    const mentions = Array.from({ length: 21 }, (_, i) => `@user${i}`).join(' ')
    expect(codes(validateVariant('INSTAGRAM', v({ body: mentions, media: [img()] }))).errors).toContain('mentions')
  })
  it('cuenta emojis como un carácter', () => {
    expect(validateVariant('INSTAGRAM', v({ body: '🙂'.repeat(2200), media: [img()] })).ok).toBe(true)
  })
  it('necesita media; carrusel 2 a 10; reel con video', () => {
    expect(codes(validateVariant('INSTAGRAM', v())).errors).toContain('media_required')
    expect(codes(validateVariant('INSTAGRAM', v({ format: 'carousel', media: [img()] }))).errors).toContain('carousel_min')
    expect(codes(validateVariant('INSTAGRAM', v({ format: 'carousel', media: Array.from({ length: 11 }, () => img()) }))).errors).toContain('carousel_max')
    expect(codes(validateVariant('INSTAGRAM', v({ format: 'reel', media: [img()] }))).errors).toContain('reel_video')
    expect(codes(validateVariant('INSTAGRAM', v({ format: 'feed', media: [img(), img()] }))).errors).toContain('single_media')
  })
  it('lo que se convierte solo es aviso; lo que no, error', () => {
    const r = validateVariant('INSTAGRAM', v({ media: [img({ mime: 'image/png', bytes: 12 * MB, width: 1000, height: 3000 })] }))
    expect(r.ok).toBe(true)
    expect(codes(r).warnings).toEqual(expect.arrayContaining(['image_format', 'image_size', 'image_ratio']))
    expect(codes(validateVariant('INSTAGRAM', v({ media: [vid({ durationSec: 2 })] }))).errors).toContain('video_short')
    expect(codes(validateVariant('INSTAGRAM', v({ media: [vid({ durationSec: 16 * 60 })] }))).errors).toContain('video_long')
    expect(codes(validateVariant('INSTAGRAM', v({ media: [vid({ bytes: 400 * MB })] }))).errors).toContain('video_size')
  })
  it('formato automático según los archivos', () => {
    expect(instagramFormat(null, [img()])).toBe('feed')
    expect(instagramFormat(null, [vid()])).toBe('reel')
    expect(instagramFormat(null, [img(), vid()])).toBe('carousel')
    expect(instagramFormat('reel', [vid()])).toBe('reel')
  })
})

describe('Facebook', () => {
  it('no mezcla imágenes y video; un solo video; máximo 10 imágenes', () => {
    expect(codes(validateVariant('FACEBOOK', v({ media: [img(), vid()] }))).errors).toContain('mixed_media')
    expect(codes(validateVariant('FACEBOOK', v({ media: [vid(), vid()] }))).errors).toContain('one_video')
    expect(codes(validateVariant('FACEBOOK', v({ media: Array.from({ length: 11 }, () => img()) }))).errors).toContain('images_max')
  })
  it('publicación vacía es error; muchos hashtags es aviso', () => {
    expect(codes(validateVariant('FACEBOOK', v({ body: '' }))).errors).toContain('empty')
    expect(validateVariant('FACEBOOK', v({ body: '', linkUrl: 'https://lohaggo.com' })).ok).toBe(true)
    expect(codes(validateVariant('FACEBOOK', v({ body: '#a #b #c #d' }))).warnings).toContain('hashtags')
  })
})

describe('Web: SEO', () => {
  const long = `Intro\n\n## Subtítulo\n\n${'palabra '.repeat(320)}`
  it('título, URL y contenido son obligatorios', () => {
    expect(codes(validateVariant('WEB', v({ body: '' }))).errors).toEqual(expect.arrayContaining(['title', 'slug', 'body']))
    expect(codes(validateVariant('WEB', v({ title: 'T', slug: 'Con Mayúsculas', body: long }))).errors).toContain('slug_format')
  })
  it('avisos de SEO', () => {
    const r = validateVariant('WEB', v({ title: 'Un título muy largo que supera claramente los sesenta caracteres permitidos', slug: 'ok', body: 'corto' }))
    expect(r.ok).toBe(true)
    expect(codes(r).warnings).toEqual(expect.arrayContaining(['thin_content', 'seo_title', 'seo_description', 'og_image']))
    const good = validateVariant('WEB', v({ title: 'Cómo limpiar un sofá', slug: 'como-limpiar-un-sofa', body: long, seoDescription: 'x'.repeat(140), coverUrl: 'https://res.cloudinary.com/a/image/upload/x.jpg' }))
    expect(good.warnings).toEqual([])
  })
  it('cuenta hashtags con tildes y menciones', () => {
    expect(countHashtags('#Medellín #hogar y C# no')).toBe(2)
    expect(countMentions('hola @ana.p y correo a@b.com')).toBe(1)
  })
})

describe('SEO: utilidades', () => {
  it('slug', () => {
    expect(slugify('¿Cómo reparar una fuga de agua en la cocina?')).toBe('como-reparar-una-fuga-de-agua-en-la-cocina')
    expect(slugify('Señales de que necesitas un electricista')).toBe('senales-de-que-necesitas-un-electricista')
    expect(slugify('a '.repeat(100)).length).toBeLessThanOrEqual(80)
  })
  it('extracto y lectura', () => {
    expect(stripMarkdown('## Hola\n\n**Negrita** y [enlace](https://x.com)')).toBe('Hola Negrita y enlace')
    expect(makeExcerpt('palabra '.repeat(100), 50).length).toBeLessThanOrEqual(50)
    expect(readingMinutes('palabra '.repeat(400))).toBe(2)
  })
  it('Markdown seguro: nada ejecutable pasa', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n[x](javascript:alert(1)) ![i](javascript:alert(1)) [ok](https://www.lohaggo.com)')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toMatch(/href="javascript/i)
    expect(html).not.toMatch(/src="javascript/i)
    expect(html).toContain('<a href="https://www.lohaggo.com">ok</a>')
    expect(safeUrl('data:text/html,x')).toBeNull()
  })
  it('Markdown: estructura', () => {
    const html = renderMarkdown('# Título\n\n## Sub\n\nPárrafo **fuerte** y *suave*.\n\n- uno\n- dos\n\n1. a\n2. b\n\n> cita\n\n```\ncódigo <b>\n```')
    expect(html).toContain('<h2 id="titulo">Título</h2>')
    expect(html).toContain('<h2 id="sub">Sub</h2>')
    expect(html).toContain('<strong>fuerte</strong>')
    expect(html).toContain('<em>suave</em>')
    expect(html).toContain('<ul><li>uno</li><li>dos</li></ul>')
    expect(html).toContain('<ol><li>a</li><li>b</li></ol>')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('<pre><code>código &lt;b&gt;</code></pre>')
  })
  it('enlaces externos abren aparte', () => {
    expect(renderMarkdown('[g](https://google.com)')).toContain('target="_blank" rel="noopener noreferrer"')
  })
  it('JSON-LD no puede cerrar la etiqueta script', () => {
    const ld = articleJsonLd({ title: 'x</script><script>alert(1)', description: 'd', slug: 's', image: null, publishedAt: new Date(0), updatedAt: new Date(0) })
    expect(jsonLdScript(ld)).not.toContain('</script>')
    expect(ld['@type']).toBe('BlogPosting')
  })
})

describe('media por red', () => {
  const url = 'https://res.cloudinary.com/demo/image/upload/v1/lohaggo/marketing/foto.png'
  it('Instagram: JPEG, ancho máximo y relleno si la proporción no sirve', () => {
    expect(deliveryUrl('INSTAGRAM', url, { kind: 'image', width: 1080, height: 1080 })).toBe('https://res.cloudinary.com/demo/image/upload/c_limit,w_1440,f_jpg,q_90/v1/lohaggo/marketing/foto.jpg')
    expect(deliveryUrl('INSTAGRAM', url, { kind: 'image', width: 1000, height: 3000 })).toContain('c_pad,ar_4:5')
    expect(deliveryUrl('INSTAGRAM', url, { kind: 'image', width: 3000, height: 1000 })).toContain('c_pad,ar_191:100')
  })
  it('video a MP4 H.264 para redes; web y URLs ajenas intactas', () => {
    const video = 'https://res.cloudinary.com/demo/video/upload/v1/clip.mov'
    expect(deliveryUrl('FACEBOOK', video, { kind: 'video' })).toBe('https://res.cloudinary.com/demo/video/upload/vc_h264,ac_aac,q_auto/v1/clip.mp4')
    expect(deliveryUrl('WEB', video, { kind: 'video' })).toBe(video)
    expect(deliveryUrl('INSTAGRAM', 'https://otra.com/a.png', { kind: 'image' })).toBe('https://otra.com/a.png')
  })
  it('Open Graph 1200×630 y póster de video', () => {
    expect(ogImageUrl(url)).toContain('c_fill,g_auto,w_1200,h_630')
    expect(videoPosterUrl('https://res.cloudinary.com/demo/video/upload/v1/clip.mp4')).toBe('https://res.cloudinary.com/demo/video/upload/so_1,w_600,c_limit/v1/clip.jpg')
    expect(videoPosterUrl(url)).toBeNull()
  })
})

describe('publicador: errores, reintentos y estado', () => {
  it('clasifica los errores de Meta', () => {
    expect(classifyGraphError({ code: 190, subcode: 460, message: 'x' })).toMatchObject({ retryable: false, tokenProblem: true })
    expect(classifyGraphError({ code: 190, subcode: 460, message: 'x' }).reason).toContain('contraseña')
    expect(classifyGraphError({ code: 200, message: 'Permissions error' })).toMatchObject({ retryable: false, tokenProblem: true })
    expect(classifyGraphError({ code: 4, message: 'rate' })).toMatchObject({ retryable: true })
    expect(classifyGraphError({ code: 9007, message: 'not ready' })).toMatchObject({ retryable: true })
    expect(classifyGraphError({ status: 503, message: 'down' })).toMatchObject({ retryable: true })
    expect(classifyGraphError({ status: 0, message: 'network' })).toMatchObject({ retryable: true })
    expect(classifyGraphError({ code: 100, message: 'Invalid parameter' })).toMatchObject({ retryable: false, tokenProblem: false })
    // Instagram could not read the file (still being generated): retried
    expect(classifyGraphError({ code: 100, message: 'Only photo or video can be accepted as media type.' })).toMatchObject({ retryable: true })
    expect(classifyGraphError({ code: 9004, subcode: 2207052, message: 'Media could not be fetched from this uri' })).toMatchObject({ retryable: true })
  })
  it('reintentos a los 2, 10 y ninguno más', () => {
    const now = new Date('2026-09-26T10:00:00Z')
    expect(nextAttemptAt(1, now)?.toISOString()).toBe('2026-09-26T10:02:00.000Z')
    expect(nextAttemptAt(2, now)?.toISOString()).toBe('2026-09-26T10:10:00.000Z')
    expect(nextAttemptAt(3, now)).toBeNull()
  })
  it('estado agregado de la publicación', () => {
    expect(aggregatePostStatus('scheduled', ['published', 'published'])).toBe('published')
    expect(aggregatePostStatus('scheduled', ['published', 'failed'])).toBe('partial')
    expect(aggregatePostStatus('scheduled', ['failed', 'failed'])).toBe('failed')
    expect(aggregatePostStatus('draft', ['scheduled', 'scheduled'])).toBe('scheduled')
    expect(aggregatePostStatus('scheduled', ['published', 'processing'])).toBe('publishing')
    expect(aggregatePostStatus('scheduled', ['published', 'scheduled'])).toBe('publishing')
    expect(aggregatePostStatus('scheduled', ['cancelled'])).toBe('approved')
    expect(aggregatePostStatus('draft', [])).toBe('draft')
  })
  it('un fallo reemplazado por un envío posterior a la misma cuenta no cuenta', () => {
    const at = (m: number) => new Date(Date.UTC(2026, 8, 24, 23, m))
    const pubs = [
      { channel: 'INSTAGRAM', connectionId: 'ig', createdAt: at(20), status: 'failed' },
      { channel: 'FACEBOOK', connectionId: 'fb1', createdAt: at(20), status: 'published' },
      { channel: 'WEB', connectionId: null, createdAt: at(20), status: 'published' },
      { channel: 'INSTAGRAM', connectionId: 'ig', createdAt: at(21), status: 'published' },
    ]
    const latest = latestPerTarget(pubs)
    expect(latest).toHaveLength(3)
    expect(aggregatePostStatus('partial', latest.map((p) => p.status as 'published'))).toBe('published')
    // Another account that really failed still makes it partial
    expect(aggregatePostStatus('partial', latestPerTarget([...pubs, { channel: 'FACEBOOK', connectionId: 'fb2', createdAt: at(20), status: 'failed' }]).map((p) => p.status as 'published'))).toBe('partial')
  })
  it('un reintento reconoce lo que ya salió (no publica dos veces)', () => {
    const since = new Date('2026-09-26T10:00:00Z')
    const recent = [
      { id: 'old', message: 'Hola  mundo', createdAt: new Date('2026-09-20T10:00:00Z') },
      { id: 'new', message: 'hola mundo', createdAt: new Date('2026-09-26T10:00:30Z') },
    ]
    expect(findAlreadyPublished(recent, 'Hola mundo', since)?.id).toBe('new')
    expect(findAlreadyPublished(recent, 'Otro texto', since)).toBeNull()
    expect(findAlreadyPublished(recent, '', since)).toBeNull()
  })
  it('programar solo en el futuro', () => {
    const now = new Date('2026-09-26T10:00:00Z')
    expect(canSchedule(new Date('2026-09-26T10:05:00Z'), now)).toBe(true)
    expect(canSchedule(new Date('2026-09-26T10:00:10Z'), now)).toBe(false)
  })
  it('cadencia de métricas', () => {
    const now = new Date('2026-09-26T12:00:00Z')
    const ago = (h: number) => new Date(now.getTime() - h * 3600_000)
    expect(metricsDue(ago(5), null, now)).toBe(true)
    expect(metricsDue(ago(5), ago(0.5), now)).toBe(false)
    expect(metricsDue(ago(5), ago(1), now)).toBe(true)
    expect(metricsDue(ago(72), ago(3), now)).toBe(false)
    expect(metricsDue(ago(72), ago(6), now)).toBe(true)
    expect(metricsDue(ago(24 * 10), ago(12), now)).toBe(false)
    expect(metricsDue(ago(24 * 31), null, now)).toBe(false)
  })
})

describe('entradas', () => {
  it('campaña', () => {
    expect(sanitizeCampaignInput({ name: ' Lluvias ', objective: 'traffic', color: '#123abc', budget: '500000' })).toEqual({ name: 'Lluvias', objective: 'traffic', color: '#123abc', budget: 500000 })
    expect(() => sanitizeCampaignInput({ name: '' })).toThrow()
    expect(() => sanitizeCampaignInput({ startsAt: '2026-10-10', endsAt: '2026-10-01' })).toThrow()
    expect(sanitizeCampaignInput({ objective: 'otro', color: 'red' })).toEqual({})
  })
  it('publicación', () => {
    expect(sanitizePostInput({ title: ' T ', status: 'review' })).toEqual({ title: 'T', status: 'review' })
    expect(sanitizePostInput({ status: 'published' })).toEqual({})
    expect(() => sanitizePostInput({ title: '  ' })).toThrow()
  })
  it('variantes: los campos web solo en la web y los enlaces solo https', () => {
    expect(sanitizeVariantInput({ channel: 'WEB', slug: 'Cómo Limpiar', tags: ['Hogar', 'hogar', ''] })).toMatchObject({ slug: 'como-limpiar', tags: ['hogar'] })
    expect(sanitizeVariantInput({ channel: 'FACEBOOK', slug: 'x', seoTitle: 'y' })).toEqual({ channel: 'FACEBOOK' })
    expect(() => sanitizeVariantInput({ channel: 'FACEBOOK', linkUrl: 'javascript:alert(1)' })).toThrow()
    expect(sanitizeVariantInput({ channel: 'INSTAGRAM', format: 'story' })).toEqual({ channel: 'INSTAGRAM', format: null })
    expect(() => sanitizeVariantInput({ channel: 'TIKTOK' })).toThrow()
  })
  it('media subida: solo de nuestra cuenta y de la carpeta de la publicación', () => {
    const ok = { url: 'https://res.cloudinary.com/haggo/image/upload/v1/lohaggo/marketing/ws/p1/a.jpg', publicId: 'lohaggo/marketing/ws/p1/a', bytes: 1000, width: 10, height: 10 }
    expect(validateUploadedMedia(ok, 'haggo', 'lohaggo/marketing/ws/p1')).toMatchObject({ kind: 'image', bytes: 1000 })
    expect(() => validateUploadedMedia(ok, 'otra', 'lohaggo/marketing/ws/p1')).toThrow()
    expect(() => validateUploadedMedia({ ...ok, publicId: 'lohaggo/marketing/ws/p2/a' }, 'haggo', 'lohaggo/marketing/ws/p1')).toThrow()
    expect(() => validateUploadedMedia({ ...ok, url: 'https://evil.com/a.jpg' }, 'haggo', 'lohaggo/marketing/ws/p1')).toThrow()
  })
})

describe('copiloto de redacción', () => {
  it('cada canal con su estilo', () => {
    expect(userPrompt({ action: 'draft', channel: 'INSTAGRAM', brief: 'lluvias' })).toContain('hashtags')
    expect(userPrompt({ action: 'draft', channel: 'WEB', brief: 'lluvias' })).toContain('Markdown')
    expect(userPrompt({ action: 'adapt', channel: 'INSTAGRAM', sourceChannel: 'WEB', text: 'Artículo' })).toContain('desde el blog del sitio web')
  })
  it('la campaña enmarca el texto', () => {
    const p = userPrompt({ action: 'draft', channel: 'FACEBOOK', campaign: { name: 'Lluvias', objective: 'traffic', description: 'Revisar techos' } })
    expect(p).toContain('Campaña: Lluvias')
    expect(p).toContain('tráfico al sitio web')
    expect(p).toContain('Revisar techos')
  })
  it('no inventa datos', () => {
    expect(systemPrompt({ brand: 'LoHaggo', services: ['Plomería'], cities: ['Medellín'], siteUrl: 'https://x' })).toContain('No inventes precios')
  })
  it('lee JSON y hashtags de la respuesta', () => {
    expect(parseJson<{ a: number }>('Claro:\n```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(parseJson('sin json')).toBeNull()
    expect(parseHashtags('#Hogar #hogar #Medellín, #hogar')).toEqual(['#Hogar', '#hogar', '#Medellín'])
  })
})

describe('permisos y tokens', () => {
  it('permisos de marketing', () => {
    expect(resolveMarketingGrants('OWNER', [])).toEqual(['marketing.view', 'marketing.edit', 'marketing.publish'])
    expect(resolveMarketingGrants('MEMBER', ['marketing.publish'])).toEqual(['marketing.view', 'marketing.publish'])
    expect(resolveMarketingGrants('MEMBER', ['ai.view'])).toEqual([])
  })
  it('renovar el token de la persona 15 días antes de que venza', () => {
    const now = new Date('2026-09-26T00:00:00Z')
    expect(shouldRenew(new Date(now.getTime() + RENEW_BEFORE_MS - 1000), now)).toBe(true)
    expect(shouldRenew(new Date(now.getTime() + RENEW_BEFORE_MS + 1000), now)).toBe(false)
    expect(shouldRenew(new Date(now.getTime() - 1000), now)).toBe(false)
    expect(shouldRenew(null, now)).toBe(false)
  })
})

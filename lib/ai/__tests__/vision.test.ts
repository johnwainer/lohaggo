import type Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'
import {
  attachImages,
  checkDownloadedImage,
  decodeDescription,
  describedImages,
  descriptionMap,
  encodeDescription,
  extractPhotoDescriptions,
  isStickerLike,
  selectTurnImages,
  sniffImageMime,
  type TurnMessage,
} from '@/lib/ai/vision-core'
import { messageText, toTurns } from '@/lib/ai/runtime-core'
import { buildRequest } from '@/lib/ai/providers/anthropic'
import { toOpenAIInput, toOpenAIRequest } from '@/lib/ai/providers/translate'

const msg = (id: string, over: Partial<TurnMessage> = {}): TurnMessage => ({ id, direction: 'INBOUND', body: '📷 Imagen', mediaUrl: `https://api.twilio.com/m/${id}`, mediaType: 'image/jpeg', ...over })

const jpeg = (size = 5000) => {
  const b = new Uint8Array(size)
  b.set([0xff, 0xd8, 0xff, 0xe0])
  return b
}

describe('selectTurnImages · qué fotos ve el agente', () => {
  it('solo fotos entrantes del turno, las más recientes hasta el máximo, en orden', () => {
    const turn = [
      msg('a'),
      msg('t', { body: 'hola', mediaUrl: null, mediaType: null }),
      msg('b', { mediaType: 'image/png' }),
      msg('c'),
      msg('v', { mediaType: 'video/mp4', body: '🎥 Video' }),
      msg('o', { direction: 'OUTBOUND' }),
    ]
    expect(selectTurnImages(turn, { maxImages: 2, channel: 'WHATSAPP' }).map((m) => m.id)).toEqual(['b', 'c'])
    expect(selectTurnImages(turn, { maxImages: 4, channel: 'WHATSAPP' }).map((m) => m.id)).toEqual(['a', 'b', 'c'])
    expect(selectTurnImages(turn, { maxImages: 0, channel: 'WHATSAPP' })).toEqual([])
  })

  it('salta stickers (WebP por WhatsApp) y tipos que el modelo no lee; Meta («image/*») se revisa al descargar', () => {
    const turn = [msg('s', { mediaType: 'image/webp' }), msg('h', { mediaType: 'image/heic' }), msg('ig', { mediaType: 'image/*', mediaUrl: 'https://lookaside.fbsbx.com/x' })]
    expect(selectTurnImages(turn, { maxImages: 4, channel: 'WHATSAPP' }).map((m) => m.id)).toEqual(['ig'])
    expect(selectTurnImages([msg('w', { mediaType: 'image/webp' })], { maxImages: 4, channel: 'INSTAGRAM' }).map((m) => m.id)).toEqual(['w'])
    expect(isStickerLike({ mediaType: 'image/*', body: 'Sticker' }, 'MESSENGER')).toBe(true)
  })
})

describe('checkDownloadedImage', () => {
  it('reconoce el tipo real por los bytes', () => {
    expect(sniffImageMime(jpeg())).toBe('image/jpeg')
    const png = new Uint8Array(5000); png.set([0x89, 0x50, 0x4e, 0x47])
    expect(sniffImageMime(png)).toBe('image/png')
    const webp = new Uint8Array(5000); webp.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
    expect(sniffImageMime(webp)).toBe('image/webp')
    expect(sniffImageMime(new TextEncoder().encode('<html>no es una imagen</html>'))).toBeNull()
  })
  it('rechaza lo diminuto, lo muy pesado y lo que no es imagen', () => {
    expect(checkDownloadedImage(jpeg())).toEqual({ ok: true, mime: 'image/jpeg' })
    expect(checkDownloadedImage(jpeg(500)).ok).toBe(false)
    expect(checkDownloadedImage(jpeg(4_000_000)).ok).toBe(false)
    expect(checkDownloadedImage(new Uint8Array(5000)).ok).toBe(false)
  })
})

const img = { messageId: 'm1', mime: 'image/jpeg', data: 'QUJD' }

describe('attachImages · la foto viaja en el mensaje de la persona', () => {
  const base: Anthropic.MessageParam[] = [
    { role: 'user', content: 'Hola' },
    { role: 'assistant', content: '¿Qué necesitas?' },
    { role: 'user', content: 'Esto se está goteando' },
  ]

  it('Claude: «Foto n» + bloque de imagen antes del texto, y el aviso al final', () => {
    const out = attachImages(base, [img, { ...img, messageId: 'm2', mime: 'image/png' }])
    expect(out).toHaveLength(3)
    expect(base[2].content).toBe('Esto se está goteando')
    const content = out[2].content as Anthropic.ContentBlockParam[]
    expect(content.map((b) => b.type)).toEqual(['text', 'image', 'text', 'image', 'text', 'text'])
    expect(content[1]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' } })
    expect((content[3] as Anthropic.ImageBlockParam).source).toMatchObject({ media_type: 'image/png' })
    expect((content[4] as Anthropic.TextBlockParam).text).toBe('Esto se está goteando')
    const notice = (content[5] as Anthropic.TextBlockParam).text
    expect(notice).toContain('2 fotos')
    expect(notice).toContain('incluir_fotos: true')
    expect(notice).toContain('Nunca identifiques')
    expect(notice).toContain('[[FOTO 1: …]]')
    // The request to Claude carries the blocks untouched
    const req = buildRequest({ model: 'claude-sonnet-4-6', messages: out, maxTokens: 512, effort: 'low' }, 'claude-sonnet-4-6')
    expect((req.messages[2].content as Anthropic.ContentBlockParam[])[1].type).toBe('image')
  })

  it('OpenAI (failover): input_text / input_image con data URL, en el mismo orden', () => {
    const items = toOpenAIInput(attachImages(base, [img]))
    expect(items).toHaveLength(3)
    expect(items[2]).toEqual({
      role: 'user',
      content: [
        { type: 'input_text', text: 'Foto 1:' },
        { type: 'input_image', image_url: 'data:image/jpeg;base64,QUJD', detail: 'auto' },
        { type: 'input_text', text: 'Esto se está goteando' },
        { type: 'input_text', text: expect.stringContaining('1 foto') },
      ],
    })
    const url: Anthropic.MessageParam = { role: 'user', content: [{ type: 'image', source: { type: 'url', url: 'https://res.cloudinary.com/x.jpg' } }, { type: 'text', text: 'mira' }] }
    expect(toOpenAIRequest({ model: 'gpt-5', messages: [url], maxTokens: 100, effort: 'low' }, 'gpt-5').input).toEqual([
      { role: 'user', content: [{ type: 'input_image', image_url: 'https://res.cloudinary.com/x.jpg', detail: 'auto' }, { type: 'input_text', text: 'mira' }] },
    ])
  })

  it('sin fotos no cambia nada; si el último turno no es de la persona, abre uno', () => {
    expect(attachImages(base, [])).toBe(base)
    const out = attachImages([{ role: 'user', content: 'hola' }, { role: 'assistant', content: 'dime' }], [img])
    expect(out).toHaveLength(3)
    expect(out[2].role).toBe('user')
  })
})

describe('descripciones de fotos', () => {
  it('quita las líneas [[FOTO n: …]] y devuelve lo que dicen', () => {
    const r = extractPhotoDescriptions('Veo la fuga debajo del lavamanos. ¿En qué barrio estás?\n[[FOTO 1: tubo de PVC con fuga bajo un lavamanos]]\n[[ foto 2 : pared con humedad ]]')
    expect(r.text).toBe('Veo la fuga debajo del lavamanos. ¿En qué barrio estás?')
    expect(r.descriptions.get(1)).toBe('tubo de PVC con fuga bajo un lavamanos')
    expect(r.descriptions.get(2)).toBe('pared con humedad')
    expect(extractPhotoDescriptions('Hola, ¿cómo vas?')).toEqual({ text: 'Hola, ¿cómo vas?', descriptions: new Map() })
  })

  it('se guardan por mensaje y la última gana', () => {
    expect(decodeDescription(encodeDescription('msg_1', '  tubo   roto '))).toEqual({ messageId: 'msg_1', description: 'tubo roto' })
    expect(decodeDescription('sin separador')).toBeNull()
    const map = descriptionMap([encodeDescription('a', 'uno'), encodeDescription('a', 'otro'), null, encodeDescription('b', 'dos')])
    expect(map.get('a')).toBe('otro')
    expect(describedImages([{ messageId: 'x' }, { messageId: 'y' }], new Map([[2, 'pared']]))).toEqual([{ messageId: 'y', description: 'pared' }])
  })

  it('en turnos siguientes la foto se lee con su descripción en vez de «📷 Imagen»', () => {
    const photo = { id: 'p1', direction: 'INBOUND' as const, body: '📷 Imagen', mediaUrl: 'https://api.twilio.com/x', mediaType: 'image/jpeg' }
    expect(messageText(photo, 'tubo con fuga')).toBe('📷 Imagen [se veía: tubo con fuga]')
    expect(messageText({ ...photo, body: 'esto es' }, 'tubo con fuga')).toBe('📷 Imagen [se veía: tubo con fuga]: esto es')
    expect(messageText(photo)).toBe('📷 Imagen')
    expect(toTurns([photo], new Map([['p1', 'pared húmeda']]))).toEqual([{ role: 'user', content: '📷 Imagen [se veía: pared húmeda]' }])
  })
})

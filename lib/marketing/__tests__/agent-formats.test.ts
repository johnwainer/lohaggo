import { describe, expect, it } from 'vitest'
import { cloudinaryText, deliveryUrl, isStillVideo, screenOverlay, videoPosterUrl } from '@/lib/marketing/media'
import { parseDraft, variantFormat } from '@/lib/marketing/agent-core'
import { pickVideoFile } from '@/lib/marketing/images'
import { AGENT_FORMATS } from '@/lib/marketing/agent-input'
import { FORMAT_GUIDE } from '@/lib/marketing/agent-prompt'

const IMG = 'https://res.cloudinary.com/demo/image/upload/v1/lohaggo/marketing/foto.jpg'
const VID = 'https://res.cloudinary.com/demo/video/upload/v1/lohaggo/marketing/clip.mp4'
const screen = { renderText: true, storyText: '¿Humedad, manchas o moho? 100% resuelto', storyCta: 'Escríbenos 👉' }

describe('text on screen', () => {
  it('escapes commas, slashes and percent twice and drops emojis', () => {
    expect(cloudinaryText('Hola, 50% / ya 👉')).toBe('Hola%252C%2050%2525%20%252F%20ya')
  })
  it('draws the headline and the call to action only when asked', () => {
    expect(screenOverlay(screen)).toContain('l_text:Montserrat_72_bold_center:%C2%BFHumedad%252C')
    expect(screenOverlay(screen)).toContain('l_text:Montserrat_52_bold_center:Escr%C3%ADbenos,')
    expect(screenOverlay({ ...screen, renderText: false })).toBe('')
    expect(screenOverlay({ renderText: true, storyText: 'Solo titular' })).toContain('g_south,y_420')
  })
})

describe('delivery of reels and stories', () => {
  it('story photo with text fills 9:16; without text it is padded whole', () => {
    expect(deliveryUrl('INSTAGRAM', IMG, { kind: 'image' }, 'story', screen)).toMatch(/upload\/c_fill,g_auto,w_1080,h_1920\/l_text:.*\/f_jpg,q_90\/v1\/lohaggo\/marketing\/foto\.jpg$/)
    expect(deliveryUrl('INSTAGRAM', IMG, { kind: 'image' }, 'story', null)).toContain('c_pad,w_1080,h_1920,b_auto')
  })
  it('a photo «video» becomes an 8 s vertical MP4 with the text', () => {
    expect(isStillVideo(IMG)).toBe(true)
    expect(isStillVideo(VID)).toBe(false)
    const u = deliveryUrl('INSTAGRAM', IMG, { kind: 'video', durationSec: 8 }, 'reel', screen)
    expect(u).toMatch(/upload\/e_zoompan:du_8;.*\/c_fill,w_1080,h_1920\/l_text:.*\/f_mp4\/v1\/lohaggo\/marketing\/foto\.mp4$/)
    expect(videoPosterUrl(IMG)).toContain('c_fill,g_auto,w_400,h_711')
  })
  it('a stock clip is cropped to 9:16, cut to 30 s for a reel and 15 s for a story', () => {
    expect(deliveryUrl('FACEBOOK', VID, { kind: 'video', durationSec: 45 }, 'reel', screen)).toMatch(/c_fill,g_center,w_1080,h_1920,eo_30\/l_text:.*\/vc_h264,ac_aac,q_auto\/v1\/lohaggo\/marketing\/clip\.mp4$/)
    expect(deliveryUrl('INSTAGRAM', VID, { kind: 'video', durationSec: 20 }, 'story', null)).toContain('c_fill,g_center,w_1080,h_1920,eo_15/vc_h264')
    expect(deliveryUrl('FACEBOOK', VID, { kind: 'video', durationSec: 20 }, null, null)).toContain('/vc_h264,ac_aac,q_auto/')
  })
})

describe('agent formats', () => {
  it('the agent can plan reels and stories on both networks', () => {
    expect(AGENT_FORMATS.INSTAGRAM).toEqual(expect.arrayContaining(['reel', 'story']))
    expect(AGENT_FORMATS.FACEBOOK).toEqual(expect.arrayContaining(['reel', 'historia']))
    expect(FORMAT_GUIDE).toContain('Texto en pantalla')
  })

  it('maps agent formats to what each network publishes', () => {
    expect(variantFormat('FACEBOOK', 'historia')).toBe('story')
    expect(variantFormat('FACEBOOK', 'reel')).toBe('reel')
    expect(variantFormat('FACEBOOK', 'foto')).toBeNull()
    expect(variantFormat('INSTAGRAM', 'story')).toBe('story')
  })

  const base = { title: 'T', brief: 'b', service: null, cta: 'c', confidence: 0.8, risks: [], hypothesis: 'h', image: { query: 'pintura', alt: 'a', prompt: 'p' } }

  it('a planned story needs no caption but needs the text on screen', () => {
    const noScreen = parseDraft({ ...base, instagram: { caption: 'x', format: 'feed' } }, ['INSTAGRAM'], { INSTAGRAM: 'story' })
    expect(noScreen.ok).toBe(false)
    const ok = parseDraft({ ...base, instagram: { caption: '', format: 'feed' }, screen: { text: '¿Humedad?', cta: 'Escríbenos' } }, ['INSTAGRAM'], { INSTAGRAM: 'story' })
    expect(ok.ok && ok.value.instagram).toEqual({ caption: '', format: 'story' })
    expect(ok.ok && ok.value.screen?.text).toBe('¿Humedad?')
  })

  it('a Facebook story needs no text; a Facebook reel keeps its text', () => {
    const story = parseDraft({ ...base, screen: { text: 'Hola', cta: 'DM' } }, ['FACEBOOK'], { FACEBOOK: 'historia' })
    expect(story.ok && story.value.facebook).toEqual({ text: '', link: null })
    const reel = parseDraft({ ...base, facebook: { text: 'Mira', link: null }, screen: { text: 'Hola', cta: 'DM', videoQuery: 'painting wall' } }, ['FACEBOOK'], { FACEBOOK: 'reel' })
    expect(reel.ok && reel.value.screen?.videoQuery).toBe('painting wall')
  })

  it('the model cannot turn a feed piece into a reel on its own (a reel needs its video planned)', () => {
    const r = parseDraft({ ...base, instagram: { caption: 'x', format: 'reel' } }, ['INSTAGRAM'], { INSTAGRAM: 'feed' })
    expect(r.ok && r.value.instagram?.format).toBe('feed')
  })
})

describe('stock clips', () => {
  it('picks the vertical MP4 closest to 1920 px tall', () => {
    const v = {
      id: 1, width: 1080, height: 1920, duration: 12, url: 'https://pexels.com/video/1', user: { name: 'Ana', url: 'https://pexels.com/@ana' },
      video_files: [
        { quality: 'sd', file_type: 'video/mp4', width: 540, height: 960, link: 'sd.mp4' },
        { quality: 'hd', file_type: 'video/mp4', width: 1080, height: 1920, link: 'hd.mp4' },
        { quality: 'uhd', file_type: 'video/mp4', width: 2160, height: 3840, link: 'uhd.mp4' },
        { quality: 'hd', file_type: 'video/mp4', width: 1920, height: 1080, link: 'land.mp4' },
      ],
    }
    expect(pickVideoFile(v)).toMatchObject({ link: 'hd.mp4', durationSec: 12, credit: 'Ana en Pexels' })
    expect(pickVideoFile({ ...v, video_files: [v.video_files[3]] })).toBeNull()
  })
})

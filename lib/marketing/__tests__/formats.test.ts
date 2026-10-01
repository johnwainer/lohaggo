import { describe, expect, it } from 'vitest'
import { readPublishOptions, resolveFormat, sanitizePublishOptions } from '@/lib/marketing/publish-options'
import { validateVariant } from '@/lib/marketing/channel-rules'
import { igContainerExtras } from '@/lib/marketing/meta-publish'
import { deliveryUrl } from '@/lib/marketing/media'
import { sanitizeVariantInput } from '@/lib/marketing/input'
import { collectTexts } from '@/lib/marketing/editorial-core'

const img = { kind: 'image' as const, mime: 'image/jpeg', width: 1080, height: 1920 }
const vid = (durationSec: number, width = 1080, height = 1920) => ({ kind: 'video' as const, mime: 'video/mp4', durationSec, width, height })
const codes = (r: ReturnType<typeof validateVariant>) => ({ errors: r.errors.map((e) => e.code), warnings: r.warnings.map((e) => e.code) })

describe('publish options', () => {
  it('keeps only valid options and normalizes usernames', () => {
    expect(sanitizePublishOptions({ collaborators: ['@ana.co', 'ana.co', 'pepe_1'], shareToFeed: false, trialGraduation: 'SS_PERFORMANCE', storyText: '  Hola  ', junk: 1 }))
      .toEqual({ collaborators: ['ana.co', 'pepe_1'], shareToFeed: false, trialGraduation: 'SS_PERFORMANCE', storyText: 'Hola' })
    expect(sanitizePublishOptions({})).toBeNull()
  })

  it('refuses bad values with a readable message', () => {
    expect(() => sanitizePublishOptions({ collaborators: ['a', 'b', 'c', 'd'] })).toThrow(/hasta 3/)
    expect(() => sanitizePublishOptions({ collaborators: ['no valido'] })).toThrow(/no es un usuario/)
    expect(() => sanitizePublishOptions({ coverUrl: 'http://x.com/a.jpg' })).toThrow(/https/)
    expect(() => sanitizePublishOptions({ locationId: 'Medellín' })).toThrow(/id numérico/)
  })

  it('reading a broken stored value never throws', () => {
    expect(readPublishOptions({ collaborators: ['a b'] })).toEqual({})
    expect(readPublishOptions(null)).toEqual({})
  })

  it('resolves the format per network', () => {
    expect(resolveFormat('FACEBOOK', null, [img])).toBe('post')
    expect(resolveFormat('FACEBOOK', 'reel', [vid(10)])).toBe('reel')
    expect(resolveFormat('INSTAGRAM', null, [vid(10)])).toBe('reel')
    expect(resolveFormat('INSTAGRAM', 'story', [img])).toBe('story')
    expect(resolveFormat('INSTAGRAM', null, [img, img])).toBe('carousel')
  })

  it('the variant input accepts Facebook formats and options', () => {
    expect(sanitizeVariantInput({ channel: 'FACEBOOK', format: 'story', publishOptions: { storyText: 'Hola' } })).toMatchObject({ format: 'story', publishOptions: { storyText: 'Hola' } })
    expect(sanitizeVariantInput({ channel: 'FACEBOOK', format: 'post' })).toMatchObject({ format: null })
    expect(sanitizeVariantInput({ channel: 'INSTAGRAM', format: 'trial_reel' })).toMatchObject({ format: 'trial_reel' })
    expect(sanitizeVariantInput({ channel: 'INSTAGRAM', format: 'live' })).toMatchObject({ format: null })
  })
})

describe('format rules', () => {
  it('Instagram story: one file, video up to 60 s, caption and link warned', () => {
    expect(codes(validateVariant('INSTAGRAM', { body: '', format: 'story', options: { storyText: 'Hola' }, media: [img] }))).toEqual({ errors: [], warnings: [] })
    const r = codes(validateVariant('INSTAGRAM', { body: 'texto', format: 'story', linkUrl: 'https://x.co', media: [vid(75)] }))
    expect(r.errors).toContain('video_long')
    expect(r.warnings).toEqual(expect.arrayContaining(['story_caption', 'story_text', 'story_link']))
    expect(codes(validateVariant('INSTAGRAM', { body: '', format: 'story', media: [img, img] })).errors).toContain('single_media')
  })

  it('Instagram reels need a video; a feed photo needs an image', () => {
    expect(codes(validateVariant('INSTAGRAM', { body: 'x', format: 'trial_reel', media: [img] })).errors).toContain('reel_video')
    expect(codes(validateVariant('INSTAGRAM', { body: 'x', format: 'feed', media: [vid(10)] })).errors).toContain('feed_image')
    expect(codes(validateVariant('INSTAGRAM', { body: 'x', format: 'reel', media: [vid(30, 1920, 1080)] })).warnings).toContain('vertical')
  })

  it('Facebook reel: one video of 3 to 90 s and at least 540×960', () => {
    expect(codes(validateVariant('FACEBOOK', { body: 'x', format: 'reel', media: [vid(30)] })).errors).toEqual([])
    expect(codes(validateVariant('FACEBOOK', { body: 'x', format: 'reel', media: [vid(120)] })).errors).toContain('reel_duration')
    expect(codes(validateVariant('FACEBOOK', { body: 'x', format: 'reel', media: [vid(30, 360, 640)] })).errors).toContain('reel_resolution')
    expect(codes(validateVariant('FACEBOOK', { body: 'x', format: 'reel', media: [img] })).errors).toContain('reel_video')
  })

  it('Facebook story: exactly one file, video up to 60 s', () => {
    expect(codes(validateVariant('FACEBOOK', { body: '', format: 'story', options: { storyText: 'a' }, media: [img] })).errors).toEqual([])
    expect(codes(validateVariant('FACEBOOK', { body: '', format: 'story', media: [] })).errors).toContain('story_media')
    expect(codes(validateVariant('FACEBOOK', { body: '', format: 'story', media: [vid(70)] })).errors).toContain('story_duration')
  })

  it('a regular Facebook post keeps its old rules', () => {
    expect(codes(validateVariant('FACEBOOK', { body: '', media: [] })).errors).toContain('empty')
  })
})

describe('Instagram container extras', () => {
  it('reel: cover, share to feed, collaborators, location and AI label', () => {
    expect(igContainerExtras('reel', { coverUrl: 'https://c/a.jpg', thumbOffsetMs: 1000, collaborators: ['ana'], locationId: '123456' }, true))
      .toEqual({ cover_url: 'https://c/a.jpg', collaborators: ['ana'], location_id: '123456', share_to_feed: true, is_ai_generated: true })
  })
  it('trial reel defaults to manual graduation; story takes no collaborators or location', () => {
    expect(igContainerExtras('trial_reel', {})).toEqual({ trial_params: { graduation_strategy: 'MANUAL' } })
    expect(igContainerExtras('story', { collaborators: ['ana'], locationId: '123456', aiLabel: true })).toEqual({ is_ai_generated: true })
  })
  it('the person can switch the AI label off only for media that is not AI-generated', () => {
    expect(igContainerExtras('feed', { aiLabel: false }, true)).toEqual({})
    expect(igContainerExtras('feed', {}, false)).toEqual({})
  })
})

describe('story delivery and review', () => {
  it('story images are fitted to 9:16 as JPEG', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/v1/lohaggo/marketing/foto.png'
    expect(deliveryUrl('INSTAGRAM', url, { kind: 'image', width: 1080, height: 1080 }, 'story')).toContain('c_pad,w_1080,h_1920,b_auto,f_jpg')
    expect(deliveryUrl('INSTAGRAM', url, { kind: 'image', width: 1080, height: 1080 })).not.toContain('h_1920')
  })
  it('the editorial review sees the text written on the story', () => {
    const texts = collectTexts({ title: 'T', variants: [{ channel: 'INSTAGRAM', body: '', publishOptions: { storyText: 'Escríbenos por DM' } }], media: [] })
    expect(texts.find((t) => t.key === 'INSTAGRAM.storyText')?.text).toBe('Escríbenos por DM')
  })
})

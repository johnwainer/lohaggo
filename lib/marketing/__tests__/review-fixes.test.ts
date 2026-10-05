import { describe, expect, it } from 'vitest'
import { parseStoryCopy, systemPrompt, userPrompt } from '@/lib/marketing/copilot-core'
import { readPublishOptions, sanitizePublishOptions } from '@/lib/marketing/publish-options'
import { validateUploadedMedia } from '@/lib/marketing/input'
import { editorTask } from '@/lib/marketing/editorial-prompt'
import { aggregatePostStatus } from '@/lib/marketing/publisher-core'

describe('copilot for stories', () => {
  it('splits the on-screen headline and call to action', () => {
    expect(parseStoryCopy('Titular: ¿Paredes manchadas?\nLlamada a la acción: Escríbenos por DM')).toEqual({ storyText: '¿Paredes manchadas?', storyCta: 'Escríbenos por DM' })
  })
  it('asks for on-screen text in a story and uses the workspace treatment', () => {
    expect(userPrompt({ action: 'draft', channel: 'INSTAGRAM', format: 'story' })).toContain('HISTORIA')
    expect(systemPrompt({ brand: 'LoHaggo', services: [], cities: [], siteUrl: 'x', treatment: 'usted' })).toContain('de usted')
  })
})

describe('on-screen text limits', () => {
  it('refuses texts over the limit instead of cutting them', () => {
    expect(() => sanitizePublishOptions({ storyText: 'x'.repeat(91) })).toThrow(/90/)
    expect(() => sanitizePublishOptions({ storyCta: 'x'.repeat(41) })).toThrow(/40/)
  })
  it('an old saved option over the limit keeps the rest', () => {
    expect(readPublishOptions({ storyText: 'x'.repeat(120), aiLabel: true })).toEqual({ storyText: 'x'.repeat(90), aiLabel: true })
  })
})

describe('uploads', () => {
  const f = 'lohaggo/marketing/ws/p1'
  it('accepts only the exact file of the public id', () => {
    expect(validateUploadedMedia({ url: 'https://res.cloudinary.com/demo/image/upload/v1/lohaggo/marketing/ws/p1/a.jpg', publicId: 'lohaggo/marketing/ws/p1/a' }, 'demo', f).publicId).toBe('lohaggo/marketing/ws/p1/a')
    expect(() => validateUploadedMedia({ url: 'https://res.cloudinary.com/demo/image/upload/v1/docs/kyc.jpg', publicId: 'lohaggo/marketing/ws/p1/a' }, 'demo', f)).toThrow()
  })
})

describe('editor knows the format', () => {
  it('tells the editor a story shows no caption', () => {
    const t = editorTask({ texts: [], channels: ['INSTAGRAM'], round: 0, previous: null, brief: null, formats: { INSTAGRAM: 'story' } })
    expect(t).toContain('INSTAGRAM como historia')
    expect(t).toContain('no pidas hashtags')
  })
})

describe('post status', () => {
  it('a failed channel with another still queued does not lock the post as publishing', () => {
    expect(aggregatePostStatus('scheduled', ['failed', 'scheduled'])).toBe('scheduled')
  })
})

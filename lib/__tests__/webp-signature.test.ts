import { describe, expect, it } from 'vitest'
import { detectMimeFromBytes } from '@/lib/file-validation'

const bytes = (riff: string, tag: string) => new Uint8Array(Array.from(Buffer.from(riff)).concat([0, 0, 0, 0], Array.from(Buffer.from(tag)), [0, 0, 0, 0]))

describe('webp signature', () => {
  it('needs RIFF at 0-3 and WEBP at 8-11', () => {
    expect(detectMimeFromBytes(bytes('RIFF', 'WEBP'))).toBe('image/webp')
  })
  it('rejects other RIFF containers (WAV, AVI)', () => {
    expect(detectMimeFromBytes(bytes('RIFF', 'WAVE'))).toBeNull()
    expect(detectMimeFromBytes(bytes('RIFF', 'AVI '))).toBeNull()
  })
})

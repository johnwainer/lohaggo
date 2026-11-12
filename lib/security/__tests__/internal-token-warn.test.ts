import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetInternalTokenWarning, warnInternalTokenUnset } from '@/lib/security/internal-token'

describe('warnInternalTokenUnset', () => {
  beforeEach(() => resetInternalTokenWarning())
  it('logs once per hour', () => {
    const log = { error: vi.fn() }
    expect(warnInternalTokenUnset(log, 10_000_000)).toBe(true)
    expect(warnInternalTokenUnset(log, 10_000_000 + 30 * 60_000)).toBe(false)
    expect(warnInternalTokenUnset(log, 10_000_000 + 61 * 60_000)).toBe(true)
    expect(log.error).toHaveBeenCalledTimes(2)
  })
})

import { describe, expect, it } from 'vitest'
import { canSkipUnchanged, detectionSignature, snapshotHash } from '@/lib/haggo/snapshot-hash'

const now = new Date('2026-11-12T12:00:00Z')
const base = { hash: 'a', previousHash: 'a', signature: 's', lastCycle: { status: 'skipped', startedAt: new Date(now.getTime() - 300_000), signature: 's' }, lastOk: null, force: false, hasVerifications: false, now }

describe('snapshotHash', () => {
  it('ignores key order and volatile fields', () => {
    expect(snapshotHash({ at: '1', a: 1, b: { y: 2, x: 1 } })).toBe(snapshotHash({ b: { x: 1, y: 2 }, a: 1, at: '2' }))
  })
  it('changes when a number changes', () => {
    expect(snapshotHash({ a: 1 })).not.toBe(snapshotHash({ a: 2 }))
  })
})

describe('detectionSignature', () => {
  it('is order independent and severity aware', () => {
    expect(detectionSignature([{ key: 'a', severity: 'high' }, { key: 'b', severity: 'low' }])).toBe(detectionSignature([{ key: 'b', severity: 'low' }, { key: 'a', severity: 'high' }]))
    expect(detectionSignature([{ key: 'a', severity: 'high' }])).not.toBe(detectionSignature([{ key: 'a', severity: 'critical' }]))
  })
})

describe('canSkipUnchanged', () => {
  it('skips when the snapshot equals the previous one', () => {
    expect(canSkipUnchanged(base)).toBe(true)
  })
  it('does not skip when forced or when actions wait to be measured', () => {
    expect(canSkipUnchanged({ ...base, force: true })).toBe(false)
    expect(canSkipUnchanged({ ...base, hasVerifications: true })).toBe(false)
  })
  it('does not trust a previous cycle that failed', () => {
    expect(canSkipUnchanged({ ...base, lastCycle: { ...base.lastCycle, status: 'error' } })).toBe(false)
  })
  it('skips the same situations already analysed within 6 h, not after', () => {
    const t = { ...base, hash: 'b', lastOk: { status: 'ok', startedAt: new Date(now.getTime() - 3 * 3600_000), signature: 's' } }
    expect(canSkipUnchanged(t)).toBe(true)
    expect(canSkipUnchanged({ ...t, lastOk: { ...t.lastOk, startedAt: new Date(now.getTime() - 7 * 3600_000) } })).toBe(false)
    expect(canSkipUnchanged({ ...t, signature: 'other' })).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { healAccountIds } from '@/lib/marketing/reconnect'

describe('agent accounts after a disconnect', () => {
  it('keeps valid choices and «all accounts» (empty) untouched', () => {
    expect(healAccountIds(['a'], ['a', 'b'])).toEqual({ ids: ['a'], stale: false, healed: false })
    expect(healAccountIds([], ['a'])).toEqual({ ids: [], stale: false, healed: false })
  })
  it('drops ids that no longer exist', () => {
    expect(healAccountIds(['old', 'b'], ['a', 'b'])).toEqual({ ids: ['b'], stale: true, healed: true })
  })
  it('takes the only account left when every chosen one is gone', () => {
    expect(healAccountIds(['old'], ['new'])).toEqual({ ids: ['new'], stale: true, healed: true })
  })
  it('cannot guess between several accounts: stays stale for the team to choose', () => {
    expect(healAccountIds(['old'], ['a', 'b'])).toEqual({ ids: ['old'], stale: true, healed: false })
  })
})

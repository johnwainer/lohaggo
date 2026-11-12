import { describe, expect, it } from 'vitest'
import { HAIKU_MODEL, SONNET_MODEL, modelForKind } from '@/lib/ai/models'
import { buildRequest, withCachedTail } from '@/lib/ai/providers/anthropic'

const OPUS = 'claude-opus-5'

describe('modelForKind', () => {
  it('moves routine kinds off the default model', () => {
    expect(modelForKind('summary', OPUS, OPUS)).toBe(HAIKU_MODEL)
    expect(modelForKind('copilot_suggestion', OPUS, OPUS)).toBe(HAIKU_MODEL)
    expect(modelForKind('reengagement', OPUS, OPUS)).toBe(HAIKU_MODEL)
    expect(modelForKind('marketing_review_spelling', OPUS, OPUS)).toBe(HAIKU_MODEL)
    expect(modelForKind('haggo_cycle', OPUS, OPUS)).toBe(SONNET_MODEL)
    expect(modelForKind('haggo_report', OPUS, OPUS)).toBe(SONNET_MODEL)
  })
  it('keeps the default for hard kinds', () => {
    expect(modelForKind('agent_reply', OPUS, OPUS)).toBe(OPUS)
    expect(modelForKind('haggo_chat', OPUS, OPUS)).toBe(OPUS)
    expect(modelForKind('marketing_agent_strategy', OPUS, OPUS)).toBe(OPUS)
  })
  it('respects an explicit model (agent or settings override)', () => {
    expect(modelForKind('summary', 'claude-sonnet-5', OPUS)).toBe('claude-sonnet-5')
    expect(modelForKind('haggo_cycle', 'claude-opus-5-custom', OPUS)).toBe('claude-opus-5-custom')
  })
  it('never moves up: a cheaper default stays', () => {
    expect(modelForKind('haggo_cycle', 'claude-sonnet-5', 'claude-sonnet-5')).toBe('claude-sonnet-5')
    expect(modelForKind('summary', HAIKU_MODEL, HAIKU_MODEL)).toBe(HAIKU_MODEL)
    expect(modelForKind('haggo_cycle', HAIKU_MODEL, HAIKU_MODEL)).toBe(HAIKU_MODEL)
  })
  it('leaves OpenAI defaults alone', () => {
    expect(modelForKind('summary', 'gpt-6-sol', 'gpt-6-sol')).toBe('gpt-6-sol')
  })
})

describe('prompt cache tail', () => {
  it('marks the last block of the last message', () => {
    const out = withCachedTail([{ role: 'user', content: 'hola' }, { role: 'assistant', content: [{ type: 'text', text: 'x' }] }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: 'ok' }] }])
    const last = out[2].content as unknown as Array<Record<string, unknown>>
    expect(last[0].cache_control).toEqual({ type: 'ephemeral' })
    expect((out[1].content as unknown as Array<Record<string, unknown>>)[0].cache_control).toBeUndefined()
  })
  it('turns a string message into a cached text block', () => {
    const out = withCachedTail([{ role: 'user', content: 'hola' }])
    expect(out[0].content).toEqual([{ type: 'text', text: 'hola', cache_control: { type: 'ephemeral' } }])
  })
  it('only applies when asked', () => {
    const base = { model: OPUS, messages: [{ role: 'user' as const, content: 'hola' }], maxTokens: 100, effort: 'low' as const }
    expect(buildRequest(base, OPUS).messages[0].content).toBe('hola')
    expect(Array.isArray(buildRequest({ ...base, cacheTail: true }, OPUS).messages[0].content)).toBe(true)
  })
})

/**
 * Voice notes the contact sends, turned into text before the agent reads them. OpenAI transcribes them
 * (gpt-4o-mini-transcribe, whisper-1 as a fallback) with the platform's key from IA · Plataforma; the
 * text replaces the «🎤 Nota de voz» label of the stored message, so the agent, the summary and the team
 * in the inbox read the same. When it fails (no key, no credit, a format OpenAI does not take) the
 * message is marked once and the agent asks the person to write it, a single time per conversation.
 */
import { toFile } from 'openai'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { getAiSettings, openaiClient } from '@/lib/ai/settings'
import { logFixedCostCall } from '@/lib/ai/calls'
import { checkWorkspaceBudget } from '@/lib/ai/limits'
import { getProviderStates, providerIsDown } from '@/lib/ai/providers/state'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { isTrustedAttachmentUrl } from '@/lib/messaging/attachments'

const logger = createLogger('ai-transcribe')

export const TRANSCRIBED_PREFIX = '🎤 Nota de voz (transcrita):'
export const AUDIO_NOTICE_TEXT = 'No logré escuchar tu nota de voz. ¿Me lo puedes escribir, por favor?'
const MODEL = 'gpt-4o-mini-transcribe'
const FALLBACK_MODEL = 'whisper-1'
const MAX_BYTES = 20 * 1024 * 1024
const MAX_PER_TURN = 3
/** OpenAI list prices: gpt-4o-mini-transcribe $1.25 / M audio tokens in, $5 / M text out; whisper-1 $0.006 / min */
const PRICE = { inPerTok: 1.25 / 1e6, outPerTok: 5 / 1e6, perMinute: { [MODEL]: 0.003, [FALLBACK_MODEL]: 0.006 } as Record<string, number> }

export type AudioLike = { direction: string; mediaUrl: string | null; mediaType: string | null; body: string }

export const isAudioMessage = (m: AudioLike) => m.direction === 'INBOUND' && Boolean(m.mediaUrl) && (m.mediaType ?? '').toLowerCase().startsWith('audio')
export const isTranscribed = (m: AudioLike) => m.body.startsWith(TRANSCRIBED_PREFIX)

const EXT: Record<string, string> = { 'audio/ogg': 'ogg', 'audio/opus': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a', 'audio/m4a': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'm4a', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/webm': 'webm', 'audio/amr': 'amr' }

function isTwilioUrl(url: string) {
  return url.startsWith('https://api.twilio.com/') || url.startsWith('https://media.twiliocdn.com/')
}
function isMetaUrl(url: string) {
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'https:' && /(^|\.)(fbcdn\.net|fbsbx\.com|cdninstagram\.com|facebook\.com|whatsapp\.net)$/i.test(hostname)
  } catch {
    return false
  }
}

/** Downloads the audio from the channel: Twilio media needs basic auth with the account's SID and token. */
async function downloadAudio(url: string, declared: string | null) {
  const twilio = isTwilioUrl(url)
  if (!twilio && !isMetaUrl(url) && !isTrustedAttachmentUrl(url)) throw new Error('origen del audio no permitido')
  const headers: Record<string, string> = {}
  if (twilio) {
    const conf = (await getMessagingProviderRuntimeConfig()).twilio?.config
    const sid = conf?.accountSid || process.env.TWILIO_ACCOUNT_SID
    const token = conf?.authToken || process.env.TWILIO_AUTH_TOKEN
    if (!sid || !token) throw new Error('Twilio sin credenciales para descargar el audio')
    headers.Authorization = `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`
  }
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`descarga ${res.status}`)
  if (Number(res.headers.get('content-length') || 0) > MAX_BYTES) throw new Error('audio de más de 20 MB')
  const buffer = Buffer.from(await res.arrayBuffer())
  if (!buffer.length || buffer.length > MAX_BYTES) throw new Error('audio vacío o muy pesado')
  const mime = ((res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() || (declared ?? '').split(';')[0].trim().toLowerCase())
  const ext = EXT[mime] ?? (mime.includes('ogg') ? 'ogg' : 'mp3')
  return { buffer, mime: mime || 'audio/ogg', name: `nota-de-voz.${ext}` }
}

type Usage = { type: 'tokens'; input_tokens: number; output_tokens: number } | { type: 'duration'; seconds: number } | undefined

export function transcriptionCost(model: string, usage: Usage, bytes: number) {
  if (usage?.type === 'tokens') return usage.input_tokens * PRICE.inPerTok + usage.output_tokens * PRICE.outPerTok
  // Duration billing, or no usage: ~2 KB per second of a WhatsApp opus note
  const seconds = usage?.type === 'duration' ? usage.seconds : bytes / 2000
  return (seconds / 60) * (PRICE.perMinute[model] ?? PRICE.perMinute[FALLBACK_MODEL])
}

async function transcribeOne(key: string, file: { buffer: Buffer; mime: string; name: string }) {
  const client = openaiClient(key)
  const upload = async () => toFile(file.buffer, file.name, { type: file.mime })
  try {
    const r = await client.audio.transcriptions.create({ file: await upload(), model: MODEL, language: 'es' })
    return { text: r.text?.trim() ?? '', model: MODEL, usage: (r as { usage?: Usage }).usage }
  } catch (err) {
    const status = (err as { status?: number })?.status
    // The account may lack the newer model; a quota or key error fails the same with any model
    if (status !== 404 && status !== 400) throw err
    const r = await client.audio.transcriptions.create({ file: await upload(), model: FALLBACK_MODEL, language: 'es' })
    return { text: r.text?.trim() ?? '', model: FALLBACK_MODEL, usage: (r as { usage?: Usage }).usage }
  }
}

export type TurnAudio = {
  /** Audio messages of this turn turned into text */
  transcribed: number
  /** Audio messages of this turn that could not be transcribed */
  failed: number
  /** The person also wrote text (or an earlier audio was transcribed) in this turn */
  hasText: boolean
}

/**
 * Transcribes the voice notes of the current turn (inbound messages since the last message the contact
 * saw from us). Each audio is tried once: a failure leaves an event so the next turn does not retry it.
 */
export async function transcribeTurnAudio(conversation: { id: string; workspaceId: string }, agentId: string | null): Promise<TurnAudio> {
  const out: TurnAudio = { transcribed: 0, failed: 0, hasText: false }
  const lastOut = await prisma.conversationMessage.findFirst({
    where: { conversationId: conversation.id, direction: 'OUTBOUND', isInternal: false },
    orderBy: { sentAt: 'desc' },
    select: { sentAt: true },
  })
  const turn = await prisma.conversationMessage.findMany({
    where: { conversationId: conversation.id, direction: 'INBOUND', ...(lastOut ? { sentAt: { gt: lastOut.sentAt } } : {}) },
    orderBy: { sentAt: 'asc' },
    take: 10,
    select: { id: true, direction: true, body: true, mediaUrl: true, mediaType: true },
  })
  const audios = turn.filter(isAudioMessage)
  out.hasText = turn.some((m) => !isAudioMessage(m) && m.body.trim() && !['📷', '🎤', '🎥', '📎'].some((i) => m.body.trim().startsWith(i))) || audios.some(isTranscribed)
  const pending = audios.filter((m) => !isTranscribed(m))
  if (!pending.length) {
    out.transcribed = audios.length
    return out
  }
  out.transcribed = audios.length - pending.length

  const tried = new Set((await prisma.conversationEvent.findMany({
    where: { conversationId: conversation.id, type: 'ai_transcription_failed', detail: { in: pending.map((m) => m.id) } },
    select: { detail: true },
  })).map((e) => e.detail))

  const settings = await getAiSettings()
  const states = await getProviderStates().catch(() => null)
  const budget = await checkWorkspaceBudget(conversation.workspaceId).catch(() => ({ state: 'ok' as const }))
  const unavailable = !settings.openaiKey ? 'sin clave de OpenAI' : states && providerIsDown(states, 'openai') ? 'OpenAI caído o sin crédito' : budget.state === 'blocked' ? 'tope mensual de IA' : null

  for (const m of pending.slice(0, MAX_PER_TURN)) {
    if (tried.has(m.id)) { out.failed++; continue }
    const started = Date.now()
    try {
      if (unavailable) throw new Error(unavailable)
      const file = await downloadAudio(m.mediaUrl!, m.mediaType)
      const r = await transcribeOne(settings.openaiKey!, file)
      if (!r.text) throw new Error('transcripción vacía')
      await prisma.conversationMessage.update({ where: { id: m.id }, data: { body: `${TRANSCRIBED_PREFIX} ${r.text.slice(0, 4000)}` } })
      await logFixedCostCall({ provider: 'openai', model: r.model, kind: 'transcription', workspaceId: conversation.workspaceId, agentId, conversationId: conversation.id, costUsd: transcriptionCost(r.model, r.usage, file.buffer.length), latencyMs: Date.now() - started })
      out.transcribed++
      out.hasText = true
    } catch (err) {
      out.failed++
      const reason = err instanceof Error ? err.message : String(err)
      logger.warn('Voice note not transcribed', { conversationId: conversation.id, messageId: m.id, reason: reason.slice(0, 200) })
      await prisma.conversationEvent.create({ data: { conversationId: conversation.id, type: 'ai_transcription_failed', actorType: 'ai', actorId: agentId, detail: m.id } }).catch(() => null)
    }
  }
  out.failed += Math.max(0, pending.length - MAX_PER_TURN)
  return out
}

/** The agent already asked this person to write instead of sending audio. */
export async function audioNoticeSent(conversationId: string) {
  return Boolean(await prisma.conversationEvent.findFirst({ where: { conversationId, type: 'ai_audio_notice' }, select: { id: true } }))
}

export async function markAudioNoticeSent(conversationId: string, agent: { id: string; name: string }) {
  await prisma.conversationEvent.create({ data: { conversationId, type: 'ai_audio_notice', actorType: 'ai', actorId: agent.id, actorName: agent.name } }).catch(() => null)
}

/**
 * Downloads a media file a contact sent through a channel. Only known origins: Twilio (needs the account's
 * SID and token), Meta's CDNs (signed URLs, no auth) and our own attachment storage. Shared by the voice
 * note transcription and the agent's image understanding.
 */
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { isTrustedAttachmentUrl } from '@/lib/messaging/attachments'

export function isTwilioMediaUrl(url: string) {
  return url.startsWith('https://api.twilio.com/') || url.startsWith('https://media.twiliocdn.com/')
}

export function isMetaMediaUrl(url: string) {
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'https:' && /(^|\.)(fbcdn\.net|fbsbx\.com|cdninstagram\.com|whatsapp\.net)$/i.test(hostname)
  } catch {
    return false
  }
}

const MAX_REDIRECTS = 3

/** The body, read in chunks and abandoned as soon as it passes `maxBytes` (null then). */
async function readCapped(res: Response, maxBytes: number): Promise<Buffer | null> {
  if (!res.body) return null
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) { await reader.cancel().catch(() => null); return null }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

export class MediaFetchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MediaFetchError'
  }
}

export async function fetchChannelMedia(url: string, opts: { maxBytes: number; timeoutMs?: number; label?: string }) {
  const label = opts.label ?? 'archivo'
  const twilio = isTwilioMediaUrl(url)
  if (!twilio && !isMetaMediaUrl(url) && !isTrustedAttachmentUrl(url)) throw new MediaFetchError(`origen del ${label} no permitido`)
  const headers: Record<string, string> = {}
  if (twilio) {
    const conf = (await getMessagingProviderRuntimeConfig()).twilio?.config
    const sid = conf?.accountSid || process.env.TWILIO_ACCOUNT_SID
    const token = conf?.authToken || process.env.TWILIO_AUTH_TOKEN
    if (!sid || !token) throw new MediaFetchError(`Twilio sin credenciales para descargar el ${label}`)
    headers.Authorization = `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`
  }
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 20_000)
  // Redirects are followed by hand: Twilio's media URL redirects to its storage (followed without the
  // credentials); any other origin may only redirect to the allowed hosts
  let current = url
  let res: Response | null = null
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    res = await fetch(current, { headers: hop === 0 ? headers : {}, redirect: 'manual', signal })
    if (res.status < 300 || res.status >= 400) break
    const next = res.headers.get('location')
    if (!next || hop === MAX_REDIRECTS) throw new MediaFetchError(`descarga ${res.status}`)
    const target = new URL(next, current).toString()
    const allowed = target.startsWith('https://') && (twilio || isMetaMediaUrl(target) || isTrustedAttachmentUrl(target) || isTwilioMediaUrl(target))
    if (!allowed) throw new MediaFetchError(`redirección del ${label} no permitida`)
    current = target
  }
  if (!res || !res.ok) throw new MediaFetchError(`descarga ${res?.status ?? 0}`)
  const mb = Math.round(opts.maxBytes / (1024 * 1024))
  if (Number(res.headers.get('content-length') || 0) > opts.maxBytes) throw new MediaFetchError(`${label} de más de ${mb} MB`)
  const buffer = await readCapped(res, opts.maxBytes)
  if (!buffer?.length) throw new MediaFetchError(`${label} vacío o muy pesado`)
  const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  return { buffer, contentType }
}

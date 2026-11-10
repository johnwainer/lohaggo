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
    return protocol === 'https:' && /(^|\.)(fbcdn\.net|fbsbx\.com|cdninstagram\.com|facebook\.com|whatsapp\.net)$/i.test(hostname)
  } catch {
    return false
  }
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
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000) })
  if (!res.ok) throw new MediaFetchError(`descarga ${res.status}`)
  const mb = Math.round(opts.maxBytes / (1024 * 1024))
  if (Number(res.headers.get('content-length') || 0) > opts.maxBytes) throw new MediaFetchError(`${label} de más de ${mb} MB`)
  const buffer = Buffer.from(await res.arrayBuffer())
  if (!buffer.length || buffer.length > opts.maxBytes) throw new MediaFetchError(`${label} vacío o muy pesado`)
  const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  return { buffer, contentType }
}

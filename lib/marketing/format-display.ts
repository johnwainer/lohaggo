/**
 * How each network's version of a post is shown in lists, the calendar and the agent: its format in
 * plain words (Reel, Historia, Carrusel, Foto…), the account, when it goes out or went out, and its
 * state. Pure: computed on the server from the variant, its media and its publications.
 */
import { resolveFormat, variantFiles } from '@/lib/marketing/publish-options'

export type LineChannel = 'WEB' | 'FACEBOOK' | 'INSTAGRAM'

/** Short name of the format a variant publishes as. */
export function formatLabel(channel: LineChannel, format: string | null | undefined, media: Array<{ kind: string }>, linkUrl?: string | null) {
  if (channel === 'WEB') return 'Artículo'
  const kinds = media.map((m) => (m.kind === 'video' ? 'video' as const : 'image' as const))
  const f = resolveFormat(channel, format, kinds.map((kind) => ({ kind })))
  if (f === 'reel') return 'Reel'
  if (f === 'trial_reel') return 'Reel de prueba'
  if (f === 'story') return 'Historia'
  if (f === 'carousel') return `Carrusel (${media.length})`
  if (f === 'feed') return 'Foto'
  // Facebook regular post: what it carries
  if (kinds.includes('video')) return 'Video'
  if (kinds.length > 1) return `Fotos (${kinds.length})`
  if (kinds.length === 1) return 'Foto'
  return linkUrl ? 'Enlace' : 'Texto'
}

/** Format names the agent plans with (ideas), in the same words. */
export function agentFormatLabel(channel: LineChannel, format: string | null | undefined) {
  const f = format ?? ''
  if (channel === 'WEB') return f ? `Artículo (${f})` : 'Artículo'
  const map: Record<string, string> = { feed: 'Foto', carousel: 'Carrusel', reel: 'Reel', trial_reel: 'Reel de prueba', story: 'Historia', historia: 'Historia', foto: 'Foto', texto: 'Texto', enlace: 'Enlace', post: 'Publicación' }
  return map[f] ?? (f || 'Publicación')
}

export type ChannelLine = {
  channel: LineChannel
  format: string
  account: string | null
  /** scheduled / processing / published / failed…; null = not queued yet */
  status: string | null
  at: string | null
  error: string | null
}

type VariantIn = { channel: string; format: string | null; mediaIds: string[]; linkUrl?: string | null; publishOptions?: unknown }
type MediaIn = { id: string; kind: string }
type PubIn = { channel: string; status: string; scheduledAt: Date | string; publishedAt: Date | string | null; lastError?: string | null; createdAt?: Date | string; connection: { name: string } | null }

const ORDER: LineChannel[] = ['INSTAGRAM', 'FACEBOOK', 'WEB']
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null)

/**
 * One line per channel and account: the latest send of each (a failure later re-sent shows the re-send);
 * a channel never queued shows its format alone.
 */
export function channelLines(variants: VariantIn[], media: MediaIn[], publications: PubIn[]): ChannelLine[] {
  const lines: ChannelLine[] = []
  const sorted = [...variants].sort((a, b) => ORDER.indexOf(a.channel as LineChannel) - ORDER.indexOf(b.channel as LineChannel))
  for (const v of sorted) {
    const channel = v.channel as LineChannel
    const files = variantFiles(v, media)
    const format = formatLabel(channel, v.format, files, v.linkUrl)
    const pubs = publications.filter((p) => p.channel === channel)
    if (!pubs.length) { lines.push({ channel, format, account: null, status: null, at: null, error: null }); continue }
    const byAccount = new Map<string, PubIn>()
    for (const p of pubs) {
      const key = p.connection?.name ?? ''
      const cur = byAccount.get(key)
      const rank = (x: PubIn) => (x.status === 'published' ? 2 : x.status === 'failed' ? 0 : 1)
      const newer = (x: PubIn) => new Date(x.createdAt ?? x.scheduledAt).getTime()
      if (!cur || rank(p) > rank(cur) || (rank(p) === rank(cur) && newer(p) > newer(cur))) byAccount.set(key, p)
    }
    for (const p of Array.from(byAccount.values())) {
      lines.push({ channel, format, account: p.connection?.name ?? null, status: p.status, at: iso(p.publishedAt ?? p.scheduledAt), error: p.status === 'failed' ? (p.lastError ?? null) : null })
    }
  }
  return lines
}

/** The date a list orders a post by: the next send if any is pending, else the last one that went out. */
export function postSortDate(lines: ChannelLine[], fallback: Date | string) {
  const pending = lines.filter((l) => l.at && ['scheduled', 'publishing', 'processing'].includes(l.status ?? '')).map((l) => l.at!).sort()
  if (pending.length) return pending[0]
  const done = lines.filter((l) => l.at).map((l) => l.at!).sort()
  return done.length ? done[done.length - 1] : new Date(fallback).toISOString()
}

export type Markers = { text: string; handoff: boolean; done: boolean; spam: boolean; ignore: boolean; sensitive: boolean; offensive: boolean }

const MARKER_RE = /\[\[\s*(HANDOFF|DONE|SPAM|IGNORAR|SENSIBLE|OFENSIVO)\s*\]\]/gi

/**
 * Extracts [[HANDOFF]] / [[DONE]] / [[SPAM]] and the comment markers ([[IGNORAR]], [[SENSIBLE]],
 * [[OFENSIVO]]) wherever the model put them; the client never sees them. [[PRIVADO]] is a separator
 * and stays in the text (see splitPublicPrivate).
 */
export function parseMarkers(raw: string): Markers {
  const found = new Set<string>()
  const text = raw.replace(MARKER_RE, (_, m: string) => {
    found.add(m.toUpperCase())
    return ''
  })
  return {
    text: text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(),
    handoff: found.has('HANDOFF'),
    done: found.has('DONE'),
    spam: found.has('SPAM'),
    ignore: found.has('IGNORAR'),
    sensitive: found.has('SENSIBLE'),
    offensive: found.has('OFENSIVO'),
  }
}

/**
 * Channels don't render Markdown. WhatsApp understands *bold*; everything else gets plain text.
 * A lone asterisk (e.g. "5 * 3", "precio*") is left untouched.
 */
export function formatForChannel(text: string, channel: string): string {
  const whatsapp = channel === 'WHATSAPP'
  let out = text

  // Headings → plain line
  out = out.replace(/^\s{0,3}#{1,6}\s+(.+)$/gm, '$1')
  // [label](url) → url (label kept only when it adds information)
  out = out.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label: string, url: string) =>
    label.trim() === url || /^https?:\/\//.test(label.trim()) ? url : `${label.trim()}: ${url}`,
  )
  // **bold** / __bold__
  out = out.replace(/\*\*([^*\s](?:[^*\n]*[^*\s])?)\*\*/g, whatsapp ? '*$1*' : '$1')
  out = out.replace(/__([^_\s](?:[^_\n]*[^_\s])?)__/g, whatsapp ? '*$1*' : '$1')
  // Single-asterisk emphasis on non-WhatsApp channels: *word* → word (needs a closing pair, no spaces inside edges)
  if (!whatsapp) out = out.replace(/(^|[\s(])\*([^*\s](?:[^*\n]*[^*\s])?)\*(?=[\s).,;:!?]|$)/gm, '$1$2')
  // Bullets
  out = out.replace(/^(\s*)[-*+]\s+/gm, '$1• ')
  // Inline code / fences
  out = out.replace(/```[a-z]*\n?([\s\S]*?)```/g, '$1').replace(/`([^`\n]+)`/g, '$1')
  return out.replace(/\n{3,}/g, '\n\n').trim()
}

export function applySignature(text: string, mode: string, signature: string | null | undefined, isFinal: boolean) {
  const sig = signature?.trim()
  if (!sig || mode === 'off') return text
  if (mode === 'final' && !isFinal) return text
  return `${text}\n\n${sig}`
}

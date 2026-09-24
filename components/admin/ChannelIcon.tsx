type Channel = 'WHATSAPP' | 'SMS' | 'MESSENGER' | 'INSTAGRAM' | 'FACEBOOK_COMMENT' | 'INSTAGRAM_COMMENT' | string

export const CHANNEL_META: Record<string, { label: string; bg: string; text: string; ring: string }> = {
  WHATSAPP: { label: 'WhatsApp', bg: 'bg-[#25D366]', text: 'text-[#128C4B]', ring: 'ring-[#25D366]/30' },
  MESSENGER: { label: 'Messenger', bg: 'bg-[#0A7CFF]', text: 'text-[#0A6BE0]', ring: 'ring-[#0A7CFF]/30' },
  INSTAGRAM: { label: 'Instagram', bg: 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]', text: 'text-[#C13584]', ring: 'ring-[#DD2A7B]/30' },
  SMS: { label: 'SMS', bg: 'bg-slate-500', text: 'text-slate-600', ring: 'ring-slate-400/30' },
  FACEBOOK_COMMENT: { label: 'Comentarios FB', bg: 'bg-[#1877F2]', text: 'text-[#1464D8]', ring: 'ring-[#1877F2]/30' },
  INSTAGRAM_COMMENT: { label: 'Comentarios IG', bg: 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]', text: 'text-[#C13584]', ring: 'ring-[#DD2A7B]/30' },
}

export function channelLabel(channel: Channel) {
  return CHANNEL_META[channel]?.label ?? channel
}

/** Brand glyph only (white on transparent), to be placed on a colored circle. */
function Glyph({ channel, px }: { channel: Channel; px: number }) {
  const className = 'block'
  const style = { width: px, height: px }
  switch (channel) {
    case 'WHATSAPP':
      return (
        <svg viewBox="0 0 24 24" style={style} className={className} fill="currentColor" aria-hidden="true">
          <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.2-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47a9.4 9.4 0 0 1 6.7 2.78 9.42 9.42 0 0 1 2.77 6.7c0 5.23-4.25 9.45-9.47 9.45zm8.06-17.52A11.33 11.33 0 0 0 12.04.64C5.76.64.64 5.75.64 12.03c0 2.01.52 3.97 1.52 5.7L.54 23.64l6.05-1.59a11.4 11.4 0 0 0 5.45 1.39h.01c6.28 0 11.39-5.11 11.4-11.4 0-3.04-1.19-5.9-3.35-8.05z" />
        </svg>
      )
    case 'MESSENGER':
      return (
        <svg viewBox="0 0 24 24" style={style} className={className} fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.14.26.35.27.57l.05 1.78c.02.57.6.94 1.12.71l1.98-.87c.17-.08.36-.09.54-.04.91.25 1.87.38 2.9.38 5.64 0 10-4.13 10-9.7S17.64 2 12 2zm6 7.46-2.94 4.66a1.5 1.5 0 0 1-2.17.4l-2.34-1.75a.6.6 0 0 0-.72 0l-3.16 2.4c-.42.32-.97-.18-.69-.63l2.94-4.66a1.5 1.5 0 0 1 2.17-.4l2.34 1.75a.6.6 0 0 0 .72 0l3.16-2.4c.42-.32.97.18.69.63z" />
        </svg>
      )
    case 'INSTAGRAM':
      return (
        <svg viewBox="0 0 24 24" style={style} className={className} fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
        </svg>
      )
    case 'FACEBOOK_COMMENT':
    case 'INSTAGRAM_COMMENT':
      // The network's color with a comment bubble (three dots) instead of the messaging glyph
      return (
        <svg viewBox="0 0 24 24" style={style} className={className} fill="currentColor" aria-hidden="true">
          <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fillOpacity="0.95" />
          <circle cx="8" cy="11" r="1.4" style={{ fill: channel === 'FACEBOOK_COMMENT' ? '#1877F2' : '#DD2A7B' }} />
          <circle cx="12" cy="11" r="1.4" style={{ fill: channel === 'FACEBOOK_COMMENT' ? '#1877F2' : '#DD2A7B' }} />
          <circle cx="16" cy="11" r="1.4" style={{ fill: channel === 'FACEBOOK_COMMENT' ? '#1877F2' : '#DD2A7B' }} />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" style={style} className={className} fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      )
  }
}

/** Colored circle with the channel's brand glyph. */
export function ChannelIcon({ channel, size = 20, className = '' }: { channel: Channel; size?: number; className?: string }) {
  const meta = CHANNEL_META[channel] ?? CHANNEL_META.SMS
  const inner = Math.round(size * 0.62)
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-white shrink-0 ${meta.bg} ${className}`}
      style={{ width: size, height: size }}
      title={meta.label}
      aria-label={meta.label}
    >
      <Glyph channel={channel} px={inner} />
    </span>
  )
}

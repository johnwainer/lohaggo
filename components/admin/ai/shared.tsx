'use client'

import { ChannelIcon } from '@/components/admin/ChannelIcon'

export type Avatar = { key: string; emoji: string; bg: string }

export const CHANNEL_LABEL: Record<string, string> = { WHATSAPP: 'WhatsApp', SMS: 'SMS', MESSENGER: 'Messenger', INSTAGRAM: 'Instagram' }

export function AgentFace({ avatar, avatars, size = 44 }: { avatar: string; avatars: Avatar[]; size?: number }) {
  const a = avatars.find((x) => x.key === avatar) ?? avatars[0]
  return (
    <span className="inline-flex items-center justify-center rounded-2xl shrink-0" style={{ width: size, height: size, background: a?.bg || '#F3F4F6', fontSize: size * 0.55 }} aria-hidden>
      {a?.emoji || '🤖'}
    </span>
  )
}

export function ChannelChips({ channels, empty = 'Todos los canales' }: { channels: string[]; empty?: string }) {
  if (!channels.length) return <span className="text-xs text-gray-500">{empty}</span>
  return (
    <span className="inline-flex flex-wrap gap-1">
      {channels.map((c) => (
        <span key={c} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
          <ChannelIcon channel={c} size={12} /> {CHANNEL_LABEL[c] || c}
        </span>
      ))}
    </span>
  )
}

export const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`

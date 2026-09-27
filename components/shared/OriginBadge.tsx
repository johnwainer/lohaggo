'use client'

import Link from 'next/link'
import { Bot, Facebook, Instagram, MessageCircle, MessageSquareText } from 'lucide-react'
import { channelLabel } from '@/lib/ops/origin'

type Props = {
  origin?: string | null
  originChannel?: string | null
  originConversationId?: string | null
  agentName?: string | null
  variant?: 'admin' | 'user'
  className?: string
}

function ChannelIcon({ channel, className }: { channel?: string | null; className: string }) {
  switch (channel) {
    case 'MESSENGER':
    case 'FACEBOOK_COMMENT':
      return <Facebook className={className} aria-hidden />
    case 'INSTAGRAM':
    case 'INSTAGRAM_COMMENT':
      return <Instagram className={className} aria-hidden />
    case 'SMS':
      return <MessageSquareText className={className} aria-hidden />
    case 'WHATSAPP':
      return <MessageCircle className={className} aria-hidden />
    default:
      return <Bot className={className} aria-hidden />
  }
}

/**
 * Marks a record that an inbox AI agent created from a chat. Renders nothing for app/admin origins.
 * `admin`: violet chip linking to the conversation. `user`: discreet grey note for client/partner cards.
 */
export default function OriginBadge({
  origin,
  originChannel,
  originConversationId,
  agentName,
  variant = 'admin',
  className = '',
}: Props) {
  if (origin !== 'chat') return null

  if (variant === 'user') {
    return (
      <span className={`inline-flex max-w-full items-center gap-1 text-xs text-gray-500 ${className}`}>
        <ChannelIcon channel={originChannel} className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Creada por chat</span>
      </span>
    )
  }

  const label = ['Por chat', channelLabel(originChannel), agentName ? `Agente ${agentName}` : null]
    .filter(Boolean)
    .join(' · ')
  const chipClass = `inline-flex max-w-full items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 ${
    originConversationId ? 'hover:bg-violet-100 transition-colors' : ''
  } ${className}`
  const content = (
    <>
      <ChannelIcon channel={originChannel} className="h-3 w-3 shrink-0" />
      <span className="truncate">{label}</span>
    </>
  )

  if (!originConversationId) {
    return <span className={chipClass} title={label}>{content}</span>
  }
  return (
    <Link
      href={`/admin/inbox?c=${encodeURIComponent(originConversationId)}`}
      className={chipClass}
      title={`${label} · abrir conversación`}
      onClick={(e) => e.stopPropagation()}
    >
      {content}
    </Link>
  )
}

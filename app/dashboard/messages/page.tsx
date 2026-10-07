'use client'

import { CountBadge } from '@/components/ui/count-badge'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { MessageSquare, Search, ShieldCheck, Package, Archive, Lock } from 'lucide-react'
import ServiceIcon from '@/components/ServiceIcon'
import { formatBookingWhen } from '@/lib/bookings/when'
import AccountTopHeader from '@/components/shared/AccountTopHeader'
import { getBookingVisualLabel, getBookingVisualState } from '@/lib/booking-status'

const ChatModal = dynamic(() => import('@/components/ChatModal'), { ssr: false, loading: () => null })

interface ConversationItem {
  id: string
  proposalId: string
  partner: { name: string; image: string | null; verified: boolean }
  service: { name: string; slug: string; icon: string }
  lastMessage: { content: string; senderId: string; createdAt: string } | null
  unreadCount: number
  updatedAt: string
  isActive: boolean
  statusLabel: string
  bookingStatus?: string | null
  booking?: { scheduledDate?: string; scheduledTime?: string; status?: string } | null
}

/** What the conversation belongs to: the booking (with its day when the API sends it) or the request */
function contextOf(conv: ConversationItem): string {
  const status = conv.booking?.status || conv.bookingStatus
  if (!status) return 'Solicitud'
  if (conv.booking?.scheduledDate) {
    return `Reserva · ${formatBookingWhen({ scheduledDate: new Date(conv.booking.scheduledDate), scheduledTime: conv.booking.scheduledTime || '' })}`
  }
  return `Reserva · ${getBookingVisualLabel(getBookingVisualState('CLIENT', { status }), 'CLIENT')}`
}

function formatRelativeDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'ahora'
  if (diffMin < 60) return `${diffMin}m`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}d`
  return d.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' })
}

export default function ClientMessagesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [chatModal, setChatModal] = useState<{ isOpen: boolean; proposalId: string; partnerName: string; serviceName: string; contextLine?: string }>({
    isOpen: false, proposalId: '', partnerName: '', serviceName: '',
  })

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'PARTNER') {
      router.push('/partner/messages')
    }
  }, [status, session, router])

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/client/messages', { cache: 'no-store' })
      if (res.ok) setConversations(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') fetchConversations()
  }, [status])

  const filtered = conversations
    .filter(c =>
      c.partner.name.toLowerCase().includes(search.toLowerCase()) ||
      c.service.name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })

  const archivedCount = conversations.filter(c => !c.isActive).length

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <AccountTopHeader role="CLIENT" title="Chats" subtitle="Conversaciones con tus profesionales" />

      <div className="mx-auto max-w-2xl px-4 py-4 md:max-w-3xl md:px-6">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
          <input
            type="search"
            aria-label="Buscar conversación"
            placeholder="Buscar conversación..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400"
          />
        </div>

        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-live="polite">
            <span className="sr-only">Cargando conversaciones…</span>
            {[1, 2, 3].map(i => (
              <div key={i} aria-hidden="true" className="animate-pulse rounded-2xl border border-gray-100 bg-white p-4">
                <div className="flex gap-3">
                  <div className="h-12 w-12 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 rounded bg-gray-200" />
                    <div className="h-3 w-2/3 rounded bg-gray-100" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white px-4 py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <MessageSquare className="h-8 w-8 text-gray-400" />
            </div>
            <p className="mb-1 font-bold text-gray-900">
              {search ? 'Sin resultados' : 'Sin conversaciones aún'}
            </p>
            <p className="mb-6 text-sm text-gray-600">
              {search
                ? 'Prueba con otro nombre de socio o servicio.'
                : 'Cuando aceptes una propuesta de un socio, el chat aparecerá aquí.'}
            </p>
            {!search && (
              <Link
                href="/dashboard?tab=requests"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition active:scale-95"
              >
                <Package className="h-4 w-4" />
                Ver mis solicitudes
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((conv, idx) => {
              const prev = filtered[idx - 1]
              const showArchivedHeader = !conv.isActive && (idx === 0 || (prev && prev.isActive))
              return (
                <div key={conv.id}>
                  {showArchivedHeader && (
                    <div className="mb-2 mt-4 flex items-center gap-2 px-1 first:mt-0">
                      <Archive className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Archivados ({archivedCount})
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setChatModal({
                      isOpen: true,
                      proposalId: conv.proposalId,
                      partnerName: conv.partner.name,
                      serviceName: conv.service.name,
                      contextLine: contextOf(conv),
                    })}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all active:scale-[0.99] ${
                      conv.isActive
                        ? 'border-gray-100 bg-white hover:border-primary-200 hover:shadow-sm'
                        : 'border-gray-100 bg-gray-50/70 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      {conv.partner.image ? (
                        <img
                          src={conv.partner.image}
                          alt=""
                          className={`h-12 w-12 rounded-full object-cover ${!conv.isActive ? 'grayscale' : ''}`}
                        />
                      ) : (
                        <div aria-hidden="true" className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold ${
                          conv.isActive ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {conv.partner.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {conv.partner.verified && conv.isActive && (
                        <span role="img" aria-label="Socio verificado" className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-primary-600 text-white">
                          <ShieldCheck className="h-3 w-3" />
                        </span>
                      )}
                      {conv.isActive && <CountBadge count={conv.unreadCount} max={9} tone="danger" label="mensajes sin leer" className="absolute -right-1 -top-1 ring-2 ring-white" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center justify-between gap-2">
                        <p className={`truncate text-sm ${
                          conv.unreadCount > 0 && conv.isActive
                            ? 'font-bold text-gray-900'
                            : conv.isActive
                              ? 'font-semibold text-gray-800'
                              : 'font-medium text-gray-600'
                        }`}>
                          {conv.partner.name}
                        </p>
                        <p className="flex-shrink-0 text-xs text-gray-600">
                          {formatRelativeDate(conv.updatedAt)}
                        </p>
                      </div>
                      <p className="flex items-center gap-1 truncate text-xs text-gray-600">
                        <ServiceIcon slug={conv.service.slug} emoji={conv.service.icon} size="sm" />
                        <span className="truncate">{conv.service.name}</span>
                        <span aria-hidden="true">·</span>
                        <span className="shrink-0 font-medium text-gray-700">{contextOf(conv)}</span>
                      </p>
                      {!conv.isActive ? (
                        <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                          <Lock className="h-3 w-3" aria-hidden="true" />
                          {conv.statusLabel}
                        </p>
                      ) : conv.lastMessage ? (
                        <p className={`mt-0.5 truncate text-xs ${conv.unreadCount > 0 ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
                          {conv.lastMessage.content}
                        </p>
                      ) : null}
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {chatModal.isOpen && (
        <ChatModal
          proposalId={chatModal.proposalId}
          partnerName={chatModal.partnerName}
          serviceName={chatModal.serviceName}
          contextLine={chatModal.contextLine}
          counterpartName={chatModal.partnerName}
          onClose={() => {
            setChatModal(p => ({ ...p, isOpen: false }))
            fetchConversations()
          }}
        />
      )}
    </div>
  )
}

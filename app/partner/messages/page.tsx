'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { MessageSquare, Search } from 'lucide-react'
import ServiceIcon from '@/components/ServiceIcon'
import PartnerHeader from '@/components/partner/PartnerHeader'

const ChatModal = dynamic(() => import('@/components/ChatModal'), { ssr: false, loading: () => null })

interface ConversationItem {
  id: string
  proposalId: string
  client: { name: string; image: string | null }
  service: { name: string; slug: string; icon: string }
  lastMessage: { content: string; senderId: string; createdAt: string } | null
  unreadCount: number
  updatedAt: string
}

export default function PartnerMessagesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [chatModal, setChatModal] = useState<{ isOpen: boolean; proposalId: string; clientName: string; serviceName: string }>({
    isOpen: false, proposalId: '', clientName: '', serviceName: '',
  })

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'PARTNER') router.push('/dashboard')
  }, [status, session])

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/partner/messages')
      if (res.ok) setConversations(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (status === 'authenticated') fetchConversations() }, [status])

  const filtered = conversations.filter(c =>
    c.client.name.toLowerCase().includes(search.toLowerCase()) ||
    c.service.name.toLowerCase().includes(search.toLowerCase())
  )

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

  return (
    <div className="account-shell">
      <PartnerHeader
        title="Mensajes"
        subtitle="Conversaciones con tus clientes"
        showNavigation
      />

      <main className="max-w-2xl md:max-w-3xl mx-auto px-4 md:px-6 py-4 pb-8">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar conversación..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none"
          />
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-gray-400" />
            </div>
            <p className="font-bold text-gray-900 mb-1">Sin conversaciones aún</p>
            <p className="text-sm text-gray-500">Cuando envíes propuestas y el cliente acepte, podrás chatear aquí.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setChatModal({ isOpen: true, proposalId: conv.proposalId, clientName: conv.client.name, serviceName: conv.service.name })}
                className="w-full bg-white rounded-2xl p-4 border border-gray-100 hover:border-primary-200 hover:shadow-sm transition-all flex items-center gap-3 text-left"
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {conv.client.image ? (
                    <img src={conv.client.image} alt={conv.client.name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-lg">
                      {conv.client.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {conv.unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
                      {conv.client.name}
                    </p>
                    <p className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                      {new Date(conv.updatedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 truncate flex items-center gap-1"><ServiceIcon slug={conv.service.slug} size="sm" /> {conv.service.name}</p>
                  {conv.lastMessage && (
                    <p className={`text-xs truncate mt-0.5 ${conv.unreadCount > 0 ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                      {conv.lastMessage.content}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {chatModal.isOpen && (
        <ChatModal
          onClose={() => { setChatModal(p => ({ ...p, isOpen: false })); fetchConversations() }}
          proposalId={chatModal.proposalId}
          partnerName={chatModal.clientName}
          serviceName={chatModal.serviceName}
        />
      )}
    </div>
  )
}

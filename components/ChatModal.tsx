'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Send, X, MessageCircle, Loader2, Lock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import PlatformTrustBanner from './PlatformTrustBanner'
import { useProposalRealtime } from '@/hooks/useChatRealtime'
import { channelLabel } from '@/lib/ops/origin'
import { PHOTO_ONLY_TEXT } from '@/lib/chat/constants'
import { useDialog } from '@/components/ui/use-dialog'

interface ChatMessage {
  id: string
  senderId: string
  content: string
  imageUrl?: string | null
  origin?: string | null
  originChannel?: string | null
  read: boolean
  createdAt: string
}

interface Chat {
  id: string
  clientId: string
  partnerId: string
  messages: ChatMessage[]
  isActive?: boolean
  statusLabel?: string
}

interface ChatModalProps {
  proposalId: string
  partnerName: string
  serviceName: string
  onClose: () => void
  /** Optional line under the service name, e.g. «Reserva · mié 8 oct 08:00 · #ABC123». */
  contextLine?: string
  /** Name of the other person in the chat; takes precedence over `partnerName` as the title. */
  counterpartName?: string
}

export default function ChatModal({ proposalId, partnerName, serviceName, onClose, contextLine, counterpartName }: ChatModalProps) {
  const title = counterpartName || partnerName
  const { data: session } = useSession()
  const [chat, setChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const { dialogProps, titleId } = useDialog(true, onClose)
  const inputId = `${titleId}-input`

  // While the photo viewer is open, Escape closes only the viewer (runs before the dialog's listener).
  useEffect(() => {
    if (!viewerUrl) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setViewerUrl(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [viewerUrl])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    fetchOrCreateChat()

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [proposalId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!loading && chat) {
      markMessagesAsRead()

      pollingIntervalRef.current = setInterval(() => {
        fetchMessages()
      }, 30000)

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
        }
      }
    }
  }, [loading, chat])

  useProposalRealtime(chat ? proposalId : null, (event) => {
    fetchMessages()
    if (event === 'message') {
      markMessagesAsRead()
    }
  })

  const fetchMessages = async () => {
    if (!chat) return

    try {
      const response = await fetch(`/api/chats?proposalId=${proposalId}`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  }

  const fetchOrCreateChat = async () => {
    try {
      setLoading(true)

      let response = await fetch(`/api/chats?proposalId=${proposalId}`)

      if (response.status === 404) {
        response = await fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposalId })
        })
      }

      if (response.ok) {
        const data = await response.json()
        setChat(data)
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Error fetching chat:', error)
    } finally {
      setLoading(false)
    }
  }

  const markMessagesAsRead = async () => {
    if (!chat) return

    try {
      await fetch(`/api/chats/${chat.id}/messages`, {
        method: 'PATCH'
      })
    } catch (error) {
      console.error('Error marking messages as read:', error)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newMessage.trim() || !chat || sending) return

    setSending(true)
    setSendError(null)
    const messageContent = newMessage.trim()
    setNewMessage('')

    try {
      const response = await fetch(`/api/chats/${chat.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageContent })
      })

      if (response.ok) {
        const { helpReply, ...message } = await response.json()
        setMessages(prev => helpReply ? [...prev, message, helpReply] : [...prev, message])
      } else {
        const errorData = await response.json()

        if (errorData.blocked && errorData.systemMessage) {
          setMessages(prev => [...prev, errorData.systemMessage])
          setNewMessage(messageContent)
        } else {
          setSendError(errorData.error || 'No se pudo enviar el mensaje. Intenta de nuevo.')
          setNewMessage(messageContent)
          if (response.status === 403 && /cerrada/i.test(errorData.error || '')) {
            setChat(prev => (prev ? { ...prev, isActive: false } : prev))
          }
        }
      }
    } catch (error) {
      setSendError('No se pudo conectar. Revisa tu conexión e intenta de nuevo.')
      setNewMessage(messageContent)
    } finally {
      setSending(false)
    }
  }

  const isOwnMessage = (senderId: string) => {
    return senderId === session?.user?.id
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 p-0 sm:flex sm:items-center sm:justify-center sm:p-4">
      <div className="absolute inset-0 hidden sm:block" aria-hidden="true" onClick={onClose} />
      <div
        {...dialogProps}
        className="relative flex h-[100dvh] w-full flex-col bg-white shadow-2xl focus:outline-none sm:h-[700px] sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-primary-500 to-secondary-500 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white sm:rounded-t-3xl sm:pt-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20" aria-hidden="true">
              <MessageCircle size={20} className="md:w-6 md:h-6" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="truncate text-base font-bold sm:text-lg">{title}</h2>
              <p className="truncate text-xs text-white/90 sm:text-sm">{serviceName}</p>
              {contextLine && (
                <p className="truncate text-xs text-white/90">{contextLine}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar chat"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain bg-gray-50 p-4 pb-3 sm:p-6">
          <PlatformTrustBanner
            variant="warning"
            context="chat"
            className="mb-4"
          />

          {loading ? (
            <div className="flex items-center justify-center h-full" role="status">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" aria-hidden="true" />
              <span className="sr-only">Cargando mensajes…</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <MessageCircle size={48} className="text-gray-300 mb-4" aria-hidden="true" />
              <p className="text-gray-700 font-medium">No hay mensajes aún</p>
              <p className="text-gray-600 text-sm mt-2">Envía el primer mensaje para iniciar la conversación</p>
            </div>
          ) : null}
          <div role="log" aria-live="polite" aria-relevant="additions" aria-label="Mensajes" className="space-y-4">
            {!loading && messages.map((message) => {
              const isSystem = message.senderId === 'SYSTEM'

              // A note from the LoHaggo team (admin): friendly, not the blocked-content warning
              if (isSystem && message.content.startsWith('🛟 Soporte LoHaggo')) {
                return (
                  <div key={message.id} className="my-4 flex justify-center">
                    <div className="max-w-[92%] rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 shadow-sm sm:max-w-[75%]">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-700">Equipo de LoHaggo</p>
                      <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-gray-800 sm:text-sm">
                        {message.content.replace(/^🛟 Soporte LoHaggo( \([^)]*\))?: /, '')}
                      </p>
                      <p className="mt-1.5 text-[11px] text-gray-600 sm:text-xs">
                        {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true, locale: es })}
                      </p>
                    </div>
                  </div>
                )
              }

              if (isSystem) {
                return (
                  <div key={message.id} className="my-4 flex justify-center">
                    <div className="max-w-[92%] rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-sm sm:max-w-[75%]">
                      <div className="flex items-start gap-2">
                        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm" aria-hidden="true">
                          ⚠️
                        </div>
                        <div className="flex-1">
                          <p className="whitespace-pre-line text-xs font-medium leading-relaxed text-gray-800 sm:text-sm">
                            {message.content}
                          </p>
                          <p className="mt-1.5 text-[11px] text-gray-600 sm:text-xs">
                            {formatDistanceToNow(new Date(message.createdAt), {
                              addSuffix: true,
                              locale: es
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage(message.senderId) ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] overflow-hidden rounded-2xl sm:max-w-[70%] ${
                      isOwnMessage(message.senderId)
                        ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow-md'
                        : 'border border-gray-200 bg-white text-gray-800'
                    }`}
                  >
                    {message.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setViewerUrl(message.imageUrl ?? null)}
                        className="relative block aspect-[4/3] w-full min-w-[220px] bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                        aria-label="Ver foto completa"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={message.imageUrl}
                          alt={isOwnMessage(message.senderId) ? 'Foto que enviaste' : 'Foto que te enviaron'}
                          loading="lazy"
                          onLoad={() => messagesEndRef.current?.scrollIntoView({ block: 'end' })}
                          className="absolute inset-0 h-full w-full object-contain"
                        />
                      </button>
                    )}
                    <div className="px-4 py-3">
                      {!(message.imageUrl && message.content === PHOTO_ONLY_TEXT) && (
                        <p className="text-sm md:text-base break-words">{message.content}</p>
                      )}
                      <p
                        className={`text-xs mt-1 ${
                          isOwnMessage(message.senderId) ? 'text-white/90' : 'text-gray-600'
                        }`}
                      >
                        {formatDistanceToNow(new Date(message.createdAt), {
                          addSuffix: true,
                          locale: es
                        })}
                        {message.origin === 'chat' && <span className="block sm:inline"><span className="hidden sm:inline"> · </span>vía {channelLabel(message.originChannel)}</span>}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div ref={messagesEndRef} />
        </div>

        {chat && chat.isActive === false ? (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:rounded-b-3xl sm:px-6 sm:py-5 sm:pb-5">
            <div className="flex items-start gap-3 rounded-xl bg-white p-3 ring-1 ring-gray-200">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600" aria-hidden="true">
                <Lock className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Conversación cerrada</p>
                <p className="mt-0.5 text-xs text-gray-600">
                  {chat.statusLabel ?? 'Conversación inactiva'}. Ya no se pueden enviar mensajes en este chat.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <form
            onSubmit={sendMessage}
            className="border-t border-gray-200 bg-white px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:rounded-b-3xl sm:px-6 sm:py-4 sm:pb-4"
          >
            {sendError && (
              <p id={`${inputId}-error`} role="alert" className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">{sendError}</p>
            )}
            <div className="flex gap-2 md:gap-3">
              <label htmlFor={inputId} className="sr-only">Escribe un mensaje</label>
              <input
                id={inputId}
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => { setNewMessage(e.target.value); if (sendError) setSendError(null) }}
                placeholder="Escribe un mensaje..."
                disabled={loading || sending}
                autoFocus
                aria-describedby={sendError ? `${inputId}-error` : undefined}
                className="min-h-[44px] min-w-0 flex-1 rounded-full border-2 border-gray-200 px-4 py-3 text-base focus:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || loading || sending}
                aria-label="Enviar mensaje"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 px-4 py-3 font-bold text-white transition-all hover:from-primary-600 hover:to-secondary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:px-6"
              >
                {sending ? (
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                ) : (
                  <>
                    <Send size={18} className="md:w-5 md:h-5" aria-hidden="true" />
                    <span className="hidden md:inline" aria-hidden="true">Enviar</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
        {viewerUrl && (
          // Rendered inside the chat dialog so its focus trap keeps the viewer reachable.
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4" onClick={() => setViewerUrl(null)} role="dialog" aria-modal="true" aria-label="Foto">
            <button type="button" autoFocus onClick={() => setViewerUrl(null)} className="absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Cerrar foto">
              <X size={22} aria-hidden="true" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewerUrl} alt="Foto del chat" className="max-h-full max-w-full rounded-2xl object-contain" />
          </div>
        )}
      </div>
    </div>
  )
}

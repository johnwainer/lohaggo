'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Send, X, MessageCircle, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import PlatformTrustBanner from './PlatformTrustBanner'

interface ChatMessage {
  id: string
  senderId: string
  content: string
  read: boolean
  createdAt: string
}

interface Chat {
  id: string
  clientId: string
  partnerId: string
  messages: ChatMessage[]
}

interface ChatModalProps {
  proposalId: string
  partnerName: string
  serviceName: string
  onClose: () => void
}

export default function ChatModal({ proposalId, partnerName, serviceName, onClose }: ChatModalProps) {
  const { data: session } = useSession()
  const [chat, setChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

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
      }, 3000)

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
        }
      }
    }
  }, [loading, chat])

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
    const messageContent = newMessage.trim()
    setNewMessage('')

    try {
      const response = await fetch(`/api/chats/${chat.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageContent })
      })

      if (response.ok) {
        const message = await response.json()
        setMessages(prev => [...prev, message])
      } else {
        const errorData = await response.json()

        if (errorData.blocked && errorData.systemMessage) {
          setMessages(prev => [...prev, errorData.systemMessage])
          setNewMessage(messageContent)
        } else {
          console.error('Error sending message:', errorData.error)
          setNewMessage(messageContent)
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setNewMessage(messageContent)
    } finally {
      setSending(false)
    }
  }

  const isOwnMessage = (senderId: string) => {
    return senderId === session?.user?.id
  }

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 p-0 sm:flex sm:items-center sm:justify-center sm:p-4">
      <div className="mt-[8vh] flex h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:mt-0 sm:h-[700px] sm:max-w-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between bg-gradient-to-r from-primary-500 to-secondary-500 px-4 py-3 text-white sm:rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
              <MessageCircle size={20} className="md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold sm:text-lg">{partnerName}</h2>
              <p className="text-xs text-white/80 sm:text-sm">{serviceName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-gray-50 p-4 pb-3 sm:p-6">
          <PlatformTrustBanner
            variant="warning"
            context="chat"
            className="mb-4"
          />

          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <MessageCircle size={48} className="text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">No hay mensajes aún</p>
              <p className="text-gray-400 text-sm mt-2">Envía el primer mensaje para iniciar la conversación</p>
            </div>
          ) : (
            messages.map((message) => {
              const isSystem = message.senderId === 'SYSTEM'

              if (isSystem) {
                return (
                  <div key={message.id} className="my-4 flex justify-center">
                    <div className="max-w-[92%] rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-sm sm:max-w-[75%]">
                      <div className="flex items-start gap-2">
                        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm">
                          ⚠️
                        </div>
                        <div className="flex-1">
                          <p className="whitespace-pre-line text-xs font-medium leading-relaxed text-gray-800 sm:text-sm">
                            {message.content}
                          </p>
                          <p className="mt-1.5 text-[10px] text-gray-500 sm:text-xs">
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
                    className={`max-w-[80%] rounded-2xl px-4 py-3 sm:max-w-[70%] ${
                      isOwnMessage(message.senderId)
                        ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow-md'
                        : 'border border-gray-200 bg-white text-gray-800'
                    }`}
                  >
                    <p className="text-sm md:text-base break-words">{message.content}</p>
                    <p
                      className={`text-xs mt-1 ${
                        isOwnMessage(message.senderId) ? 'text-white/70' : 'text-gray-500'
                      }`}
                    >
                      {formatDistanceToNow(new Date(message.createdAt), {
                        addSuffix: true,
                        locale: es
                      })}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={sendMessage}
          className="border-t border-gray-200 bg-white px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+4.75rem)] sm:rounded-b-2xl sm:px-6 sm:py-4 sm:pb-4"
        >
          <div className="flex gap-2 md:gap-3">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
              disabled={loading || sending}
              autoFocus
              className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:bg-gray-100 md:text-base"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || loading || sending}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-secondary-500 px-4 py-3 font-bold text-white transition-all hover:from-primary-600 hover:to-secondary-600 disabled:cursor-not-allowed disabled:opacity-50 md:px-6"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send size={18} className="md:w-5 md:h-5" />
                  <span className="hidden md:inline">Enviar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

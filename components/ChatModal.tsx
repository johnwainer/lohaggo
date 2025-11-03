'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Send, X, MessageCircle, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl h-[600px] md:h-[700px] flex flex-col shadow-2xl">
        <div className="bg-gradient-to-r from-[#FF2D55] to-[#FF6900] p-4 md:p-6 text-white rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 rounded-full flex items-center justify-center">
              <MessageCircle size={20} className="md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold">{partnerName}</h2>
              <p className="text-xs md:text-sm text-white/80">{serviceName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition"
          >
            <X size={20} className="md:w-6 md:h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-gray-50">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-[#FF2D55]" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageCircle size={48} className="text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">No hay mensajes aún</p>
              <p className="text-gray-400 text-sm mt-2">Envía el primer mensaje para iniciar la conversación</p>
            </div>
          ) : (
            messages.map((message) => {
              const isSystem = message.senderId === 'SYSTEM'

              if (isSystem) {
                return (
                  <div key={message.id} className="flex justify-center my-4">
                    <div className="max-w-[90%] md:max-w-[75%] bg-yellow-50 border border-yellow-400 rounded-xl px-4 py-3 shadow-sm">
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-sm">
                          ⚠️
                        </div>
                        <div className="flex-1">
                          <p className="text-xs md:text-sm text-gray-800 font-medium whitespace-pre-line leading-relaxed">
                            {message.content}
                          </p>
                          <p className="text-[10px] md:text-xs mt-1.5 text-gray-500">
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
                    className={`max-w-[75%] md:max-w-[70%] rounded-2xl px-4 py-3 ${
                      isOwnMessage(message.senderId)
                        ? 'bg-gradient-to-r from-[#FF2D55] to-[#FF6900] text-white'
                        : 'bg-white text-gray-800 border border-gray-200'
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

        <form onSubmit={sendMessage} className="p-4 md:p-6 bg-white border-t border-gray-200 rounded-b-2xl">
          <div className="flex gap-2 md:gap-3">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
              disabled={loading || sending}
              autoFocus
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF2D55] focus:border-[#FF2D55] outline-none text-sm md:text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || loading || sending}
              className="bg-gradient-to-r from-[#FF2D55] to-[#FF6900] text-white px-4 md:px-6 py-3 rounded-xl hover:from-[#FF1D45] hover:to-[#FF5900] transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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

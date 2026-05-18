'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MessageSquare, Send, RefreshCw, Search, Filter,
  User, Phone, Tag, ChevronDown, Circle, CheckCheck,
  AlertCircle, Clock, X, Users, Inbox,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

type Channel = 'SMS' | 'WHATSAPP'
type ConvStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
type Direction = 'INBOUND' | 'OUTBOUND'
type MsgStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED'

type Agent = { id: string; name: string; email: string }
type ConvUser = { id: string; name: string; email: string; role: string; image?: string | null; phone?: string | null }

type Message = {
  id: string
  direction: Direction
  body: string
  mediaUrl?: string | null
  sentAt: string
  status: MsgStatus
  sentBy?: { id: string; name: string } | null
}

type Conversation = {
  id: string
  channel: Channel
  contactPhone: string
  contactName?: string | null
  status: ConvStatus
  assignedToId?: string | null
  assignedTo?: Agent | null
  lastMessageAt?: string | null
  lastMessageBody?: string | null
  unreadCount: number
  createdAt: string
  user?: ConvUser | null
  messages?: Message[]
  _count?: { messages: number }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ConvStatus, string> = {
  OPEN: 'Abierta',
  IN_PROGRESS: 'En progreso',
  RESOLVED: 'Resuelta',
  CLOSED: 'Cerrada',
}

const STATUS_COLORS: Record<ConvStatus, string> = {
  OPEN: 'bg-emerald-100 text-emerald-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  RESOLVED: 'bg-gray-100 text-gray-600',
  CLOSED: 'bg-gray-100 text-gray-400',
}

const CHANNEL_COLOR: Record<Channel, string> = {
  WHATSAPP: 'bg-green-500',
  SMS: 'bg-blue-500',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(dateStr).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Hoy'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

function displayName(conv: Conversation) {
  return conv.user?.name || conv.contactName || conv.contactPhone
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<ConvStatus | ''>('')
  const [filterChannel, setFilterChannel] = useState<Channel | ''>('')
  const [filterAgent, setFilterAgent] = useState('')
  const [filterUnread, setFilterUnread] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch conversation list ──────────────────────────────────────────────

  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.set('status', filterStatus)
      if (filterChannel) params.set('channel', filterChannel)
      if (filterAgent) params.set('assignedToId', filterAgent)
      if (filterUnread) params.set('unreadOnly', 'true')
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/inbox/conversations?${params}`)
      const data = await res.json()
      setConversations(data.conversations || [])
      setAgents(data.agents || [])
    } catch {
      // silent refresh errors are ignored
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterChannel, filterAgent, filterUnread, search])

  useEffect(() => { loadConversations() }, [loadConversations])

  // ── Poll for new messages every 8s ──────────────────────────────────────

  useEffect(() => {
    pollRef.current = setInterval(() => {
      loadConversations(true)
      if (selected) loadConversationDetail(selected.id, true)
    }, 8000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [loadConversations, selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load conversation detail ─────────────────────────────────────────────

  async function loadConversationDetail(id: string, silent = false) {
    if (!silent) setSelected(null)
    try {
      const res = await fetch(`/api/admin/inbox/conversations/${id}`)
      const data = await res.json()
      setSelected(data.conversation)
      // update unread in list
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
      )
    } catch {
      if (!silent) setError('Error cargando conversación')
    }
  }

  function selectConversation(conv: Conversation) {
    loadConversationDetail(conv.id)
  }

  // ── Auto-scroll on new messages ─────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selected?.messages?.length])

  // ── Send message ────────────────────────────────────────────────────────

  async function sendMessage() {
    if (!selected || !messageText.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/inbox/conversations/${selected.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error enviando')
      setMessageText('')
      setSelected((prev) =>
        prev ? { ...prev, messages: [...(prev.messages || []), data.message], lastMessageBody: data.message.body, lastMessageAt: data.message.sentAt } : prev
      )
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selected.id
            ? { ...c, lastMessageBody: data.message.body, lastMessageAt: data.message.sentAt, status: 'IN_PROGRESS' }
            : c
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error enviando mensaje')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  // ── Update status ────────────────────────────────────────────────────────

  async function updateStatus(status: ConvStatus) {
    if (!selected) return
    const res = await fetch(`/api/admin/inbox/conversations/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const data = await res.json()
    if (res.ok) {
      setSelected((prev) => prev ? { ...prev, status: data.conversation.status } : prev)
      setConversations((prev) => prev.map((c) => c.id === selected.id ? { ...c, status } : c))
    }
  }

  // ── Assign agent ─────────────────────────────────────────────────────────

  async function assignAgent(agentId: string) {
    if (!selected) return
    const res = await fetch(`/api/admin/inbox/conversations/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedToId: agentId || null }),
    })
    const data = await res.json()
    if (res.ok) {
      const agent = agents.find((a) => a.id === agentId) || null
      setSelected((prev) => prev ? { ...prev, assignedToId: agentId || null, assignedTo: agent } : prev)
      setConversations((prev) =>
        prev.map((c) => c.id === selected.id ? { ...c, assignedToId: agentId || null, assignedTo: agent } : c)
      )
    }
  }

  // ── Group messages by date ───────────────────────────────────────────────

  function groupedMessages(messages: Message[]) {
    const groups: { date: string; msgs: Message[] }[] = []
    for (const msg of messages) {
      const label = formatDate(msg.sentAt)
      const last = groups[groups.length - 1]
      if (!last || last.date !== label) groups.push({ date: label, msgs: [msg] })
      else last.msgs.push(msg)
    }
    return groups
  }

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Left sidebar: conversation list ── */}
      <aside className="flex flex-col w-80 shrink-0 border-r bg-white">

        {/* Header */}
        <div className="px-4 py-3 border-b">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-gray-700" />
              <h1 className="font-bold text-gray-900">Bandeja</h1>
              {totalUnread > 0 && (
                <span className="rounded-full bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 leading-none">
                  {totalUnread}
                </span>
              )}
            </div>
            <button onClick={() => loadConversations()} className="rounded-lg p-1.5 hover:bg-gray-100 transition text-gray-500">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
            <input
              className="w-full border rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Buscar nombre, teléfono…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Filters */}
          <div className="flex gap-1.5 flex-wrap">
            <select
              className="border rounded px-2 py-1 text-xs flex-1 min-w-0"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as ConvStatus | '')}
            >
              <option value="">Todos</option>
              {(Object.keys(STATUS_LABELS) as ConvStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <select
              className="border rounded px-2 py-1 text-xs flex-1 min-w-0"
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value as Channel | '')}
            >
              <option value="">Canal</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="SMS">SMS</option>
            </select>
            <select
              className="border rounded px-2 py-1 text-xs flex-1 min-w-0"
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
            >
              <option value="">Agente</option>
              <option value="none">Sin asignar</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button
              onClick={() => setFilterUnread((v) => !v)}
              className={`rounded px-2 py-1 text-xs border transition ${filterUnread ? 'bg-red-50 border-red-300 text-red-700 font-semibold' : 'text-gray-600'}`}
            >
              No leídos
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y">
          {loading && conversations.length === 0 && (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400">Cargando…</div>
          )}
          {!loading && conversations.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-sm text-gray-400 gap-2">
              <MessageSquare className="h-8 w-8 opacity-30" />
              Sin conversaciones
            </div>
          )}
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => selectConversation(conv)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition relative ${selected?.id === conv.id ? 'bg-primary-50 border-l-2 border-primary-600' : ''}`}
            >
              {conv.unreadCount > 0 && (
                <span className="absolute right-3 top-3 rounded-full bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 leading-none">
                  {conv.unreadCount}
                </span>
              )}
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`inline-block rounded-full w-2 h-2 shrink-0 ${CHANNEL_COLOR[conv.channel]}`} />
                <span className="font-semibold text-sm text-gray-900 truncate flex-1">{displayName(conv)}</span>
                <span className="text-xs text-gray-400 shrink-0">{conv.lastMessageAt ? timeAgo(conv.lastMessageAt) : ''}</span>
              </div>
              <p className="text-xs text-gray-500 truncate pl-4">{conv.lastMessageBody || '—'}</p>
              <div className="flex items-center gap-1.5 mt-1 pl-4">
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[conv.status]}`}>{STATUS_LABELS[conv.status]}</span>
                {conv.assignedTo && (
                  <span className="text-[10px] text-gray-400 truncate">· {conv.assignedTo.name}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Right: chat view ── */}
      <div className="flex flex-col flex-1 min-w-0">

        {!selected ? (
          <div className="flex flex-col items-center justify-center flex-1 text-gray-400 gap-3">
            <MessageSquare className="h-16 w-16 opacity-20" />
            <p className="text-sm">Selecciona una conversación para comenzar</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b bg-white">
              {/* Avatar */}
              <div className="flex-shrink-0 h-9 w-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
                {displayName(selected).charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900 truncate">{displayName(selected)}</p>
                  <span className={`rounded-full w-2 h-2 shrink-0 inline-block ${CHANNEL_COLOR[selected.channel]}`} />
                  <span className="text-xs text-gray-500">{selected.channel}</span>
                </div>
                <p className="text-xs text-gray-500">{selected.contactPhone}</p>
              </div>

              {/* Agent selector */}
              <div className="flex items-center gap-1 shrink-0">
                <Users className="h-3.5 w-3.5 text-gray-400" />
                <select
                  className="border rounded-lg px-2 py-1 text-xs"
                  value={selected.assignedToId || ''}
                  onChange={(e) => assignAgent(e.target.value)}
                >
                  <option value="">Sin asignar</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div className="flex items-center gap-1 shrink-0">
                {(Object.keys(STATUS_LABELS) as ConvStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(s)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${selected.status === s ? STATUS_COLORS[s] + ' ring-1 ring-inset ring-current' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* User info bar */}
            {selected.user && (
              <div className="flex items-center gap-4 px-5 py-2 bg-amber-50 border-b text-xs text-amber-800">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span><b>{selected.user.name}</b> · {selected.user.email} · {selected.user.role}</span>
                {selected.user.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{selected.user.phone}</span>}
                <a href={`/admin/users/${selected.user.id}`} className="ml-auto underline opacity-70 hover:opacity-100" target="_blank">Ver perfil →</a>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {groupedMessages(selected.messages || []).map((group) => (
                <div key={group.date}>
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 shrink-0">{group.date}</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  <div className="space-y-2">
                    {group.msgs.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${msg.direction === 'OUTBOUND' ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-white border text-gray-800 rounded-bl-sm shadow-sm'}`}>
                          {msg.mediaUrl && (
                            <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="block mb-1 underline text-xs opacity-80">Ver adjunto</a>
                          )}
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                          <div className={`flex items-center gap-1 mt-1 ${msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
                            <span className={`text-[11px] ${msg.direction === 'OUTBOUND' ? 'text-primary-200' : 'text-gray-400'}`}>
                              {formatTime(msg.sentAt)}
                              {msg.direction === 'OUTBOUND' && msg.sentBy ? ` · ${msg.sentBy.name}` : ''}
                            </span>
                            {msg.direction === 'OUTBOUND' && (
                              msg.status === 'DELIVERED'
                                ? <CheckCheck className="h-3 w-3 text-primary-200" />
                                : msg.status === 'FAILED'
                                ? <AlertCircle className="h-3 w-3 text-red-300" />
                                : <Clock className="h-3 w-3 text-primary-200 opacity-60" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {(selected.messages || []).length === 0 && (
                <div className="flex items-center justify-center h-32 text-sm text-gray-400">Sin mensajes aún</div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Error banner */}
            {error && (
              <div className="mx-5 mb-2 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="flex-1">{error}</span>
                <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
              </div>
            )}

            {/* Closed notice */}
            {selected.status === 'CLOSED' ? (
              <div className="mx-5 mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 text-center">
                Conversación cerrada.{' '}
                <button className="underline text-primary-600" onClick={() => updateStatus('OPEN')}>Reabrir</button>
              </div>
            ) : (
              /* Message input */
              <div className="px-5 pb-4 pt-2 border-t bg-white">
                <div className="flex items-end gap-2 rounded-2xl border bg-gray-50 px-4 py-2">
                  <div className="shrink-0 flex items-center gap-1.5 text-xs text-gray-500 pb-1">
                    <span className={`rounded-full w-2 h-2 ${CHANNEL_COLOR[selected.channel]}`} />
                    {selected.channel}
                  </div>
                  <textarea
                    ref={inputRef}
                    className="flex-1 bg-transparent resize-none text-sm outline-none min-h-[36px] max-h-32 py-1"
                    placeholder={`Escribe un mensaje por ${selected.channel === 'WHATSAPP' ? 'WhatsApp' : 'SMS'}…`}
                    value={messageText}
                    rows={1}
                    onChange={(e) => {
                      setMessageText(e.target.value)
                      e.target.style.height = 'auto'
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!messageText.trim() || sending}
                    className="shrink-0 rounded-xl bg-primary-600 p-2 text-white hover:bg-primary-700 disabled:opacity-40 transition"
                  >
                    {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1 text-right">Enter para enviar · Shift+Enter para nueva línea</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

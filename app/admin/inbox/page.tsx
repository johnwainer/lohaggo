'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MessageSquare, Send, RefreshCw, Search, User, Phone,
  CheckCheck, AlertCircle, Clock, X, Users, Inbox,
  ExternalLink, Star, MapPin, ShieldCheck, Calendar,
  StickyNote, Zap, Tag, ChevronDown, Plus, Trash2, LayoutTemplate,
  ChevronUp, Link2, Copy, Check, ArrowLeft,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type QuickProfile = {
  id: string; name: string; email: string; phone: string | null; image: string | null
  role: string; isActive: boolean; createdAt: string
  clientRating: number; clientTotalReviews: number; completedServicesCount: number
  addresses: { label: string | null; street: string; neighborhood: string; city: string; isPrimary: boolean }[]
  partnerProfile: {
    bio: string | null; rating: number; totalReviews: number; completedServicesCount: number
    verified: boolean; isActive: boolean; isAvailable: boolean; city: string | null
    profileHeadline: string | null; slug: string | null
    services: { service: { name: string } }[]
    documents: { type: string; status: string }[]
    bankAccounts: { bankName: string; accountType: string; accountHolderName: string; isDefault: boolean }[]
  } | null
  bookings: { id: string; status: string; totalPrice: number; scheduledDate: string; scheduledTime: string; createdAt: string; service: { name: string } }[]
  _count: { bookings: number; serviceRequests: number; payments: number }
}

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
  isInternal: boolean
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
  tags: string[]
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

type CannedResponse = { id: string; title: string; body: string; category?: string | null }

type WaTemplate = { sid: string; name: string; body: string; variables: Record<string, string> }

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ConvStatus, string> = {
  OPEN: 'Abierta', IN_PROGRESS: 'En progreso', RESOLVED: 'Resuelta', CLOSED: 'Cerrada',
}
const STATUS_COLORS: Record<ConvStatus, string> = {
  OPEN: 'bg-emerald-100 text-emerald-800', IN_PROGRESS: 'bg-blue-100 text-blue-800',
  RESOLVED: 'bg-gray-100 text-gray-600', CLOSED: 'bg-gray-100 text-gray-400',
}
const CHANNEL_COLOR: Record<Channel, string> = { WHATSAPP: 'bg-green-500', SMS: 'bg-blue-500' }

const PRESET_TAGS = ['urgente', 'documentos', 'pago-pendiente', 'onboarding', 'reclamo', 'seguimiento', 'información']

const TAG_COLORS: Record<string, string> = {
  urgente: 'bg-red-100 text-red-700 border-red-200',
  'pago-pendiente': 'bg-orange-100 text-orange-700 border-orange-200',
  reclamo: 'bg-rose-100 text-rose-700 border-rose-200',
  documentos: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  onboarding: 'bg-purple-100 text-purple-700 border-purple-200',
  seguimiento: 'bg-blue-100 text-blue-700 border-blue-200',
  información: 'bg-gray-100 text-gray-600 border-gray-200',
}

function tagColor(tag: string) {
  return TAG_COLORS[tag] ?? 'bg-gray-100 text-gray-600 border-gray-200'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function slaLabel(conv: Conversation): { label: string; level: 'ok' | 'warn' | 'critical' } | null {
  if (!conv.lastMessageAt || conv.unreadCount === 0) return null
  const mins = Math.floor((Date.now() - new Date(conv.lastMessageAt).getTime()) / 60000)
  if (mins < 30) return null
  const label = mins < 60 ? `${mins}m sin respuesta` : `${Math.floor(mins / 60)}h sin respuesta`
  return { label, level: mins >= 120 ? 'critical' : 'warn' }
}

function isWaWindowClosed(messages: Message[]): boolean {
  const lastInbound = [...messages].reverse().find((m) => m.direction === 'INBOUND')
  if (!lastInbound) return true
  return Date.now() - new Date(lastInbound.sentAt).getTime() > 24 * 60 * 60 * 1000
}

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

// ─── Main component ───────────────────────────────────────────────────────────

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<ConvStatus | ''>('')
  const [filterChannel, setFilterChannel] = useState<Channel | ''>('')
  const [filterAgent, setFilterAgent] = useState('')
  const [filterUnread, setFilterUnread] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // New feature state
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [showCannedPicker, setShowCannedPicker] = useState(false)
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([])
  const [cannedSearch, setCannedSearch] = useState('')
  const [showTagPicker, setShowTagPicker] = useState(false)
  const [msgSearch, setMsgSearch] = useState('')
  const [showMsgSearch, setShowMsgSearch] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [waTemplates, setWaTemplates] = useState<WaTemplate[]>([])
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({})
  const [selectedTemplate, setSelectedTemplate] = useState<WaTemplate | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sseRef = useRef<EventSource | null>(null)

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
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [filterStatus, filterChannel, filterAgent, filterUnread, search])

  useEffect(() => { loadConversations() }, [loadConversations])

  // ── SSE real-time connection (falls back to polling) ─────────────────────

  useEffect(() => {
    function connectSSE() {
      const es = new EventSource('/api/admin/inbox/stream')
      sseRef.current = es

      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data)
          if (event.type === 'new-message' || event.type === 'status-update') {
            loadConversations(true)
            if (selected?.id === event.conversationId) {
              loadConversationDetail(event.conversationId, true)
            }
          }
        } catch { /* ignore */ }
      }

      es.onerror = () => {
        es.close()
        sseRef.current = null
        // Reconnect after 5s
        setTimeout(connectSSE, 5000)
      }
    }

    connectSSE()

    // Polling fallback (30s — SSE handles real-time, this is a safety net)
    pollRef.current = setInterval(() => {
      loadConversations(true)
      if (selected) loadConversationDetail(selected.id, true)
    }, 30000)

    return () => {
      sseRef.current?.close()
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [loadConversations, selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Canned responses ─────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/admin/inbox/canned-responses')
      .then((r) => r.json())
      .then((d) => setCannedResponses(d.responses || []))
      .catch(() => { /* ignore */ })
  }, [])

  // ── WA templates (lazy load) ─────────────────────────────────────────────

  function loadWaTemplates() {
    if (waTemplates.length > 0) { setShowTemplatePicker(true); return }
    fetch('/api/admin/messaging/wa-templates')
      .then((r) => r.json())
      .then((d) => { setWaTemplates(d.templates || []); setShowTemplatePicker(true) })
      .catch(() => { /* ignore */ })
  }

  // ── Load conversation detail ─────────────────────────────────────────────

  async function loadConversationDetail(id: string, silent = false) {
    if (!silent) setSelected(null)
    try {
      const res = await fetch(`/api/admin/inbox/conversations/${id}`)
      const data = await res.json()
      setSelected(data.conversation)
      setHasMore(data.hasMore ?? false)
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)))
    } catch {
      if (!silent) setError('Error cargando conversación')
    }
  }

  async function loadMoreMessages() {
    if (!selected || !hasMore || loadingMore) return
    const oldest = selected.messages?.[0]
    if (!oldest) return
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/admin/inbox/conversations/${selected.id}?before=${encodeURIComponent(oldest.sentAt)}&limit=60`)
      const data = await res.json()
      const older: Message[] = data.conversation?.messages || []
      setSelected((prev) => prev ? { ...prev, messages: [...older, ...(prev.messages || [])] } : prev)
      setHasMore(data.hasMore ?? false)
    } finally {
      setLoadingMore(false)
    }
  }

  function selectConversation(conv: Conversation) {
    setShowMsgSearch(false)
    setMsgSearch('')
    setIsInternalNote(false)
    setShowTemplatePicker(false)
    setSelectedTemplate(null)
    setMobileView('chat')
    loadConversationDetail(conv.id)
  }

  // ── Auto-scroll ──────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selected?.messages?.length])

  // ── Keyboard shortcut: Ctrl+F for in-conversation search ─────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && selected) {
        e.preventDefault()
        setShowMsgSearch((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  // ── Send message ─────────────────────────────────────────────────────────

  async function sendMessage() {
    if (!selected || !messageText.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/inbox/conversations/${selected.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText.trim(), isInternal }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error enviando')
      setMessageText('')
      setIsInternalNote(false)
      setSelected((prev) =>
        prev ? { ...prev, messages: [...(prev.messages || []), data.message], lastMessageBody: data.message.body, lastMessageAt: data.message.sentAt } : prev
      )
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selected.id
            ? { ...c, lastMessageBody: data.message.body, lastMessageAt: data.message.sentAt, status: isInternalNote ? c.status : 'IN_PROGRESS' }
            : c
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error enviando')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  async function sendTemplate() {
    if (!selected || !selectedTemplate || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/inbox/conversations/${selected.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: selectedTemplate.body,
          waContentSid: selectedTemplate.sid,
          waVariables: templateVars,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error enviando')
      setShowTemplatePicker(false)
      setSelectedTemplate(null)
      setTemplateVars({})
      setSelected((prev) =>
        prev ? { ...prev, messages: [...(prev.messages || []), data.message] } : prev
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error enviando')
    } finally {
      setSending(false)
    }
  }

  // ── Status / assign ──────────────────────────────────────────────────────

  async function updateStatus(status: ConvStatus) {
    if (!selected) return
    const res = await fetch(`/api/admin/inbox/conversations/${selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const data = await res.json()
    if (res.ok) {
      setSelected((prev) => prev ? { ...prev, status: data.conversation.status } : prev)
      setConversations((prev) => prev.map((c) => c.id === selected.id ? { ...c, status } : c))
    }
  }

  async function assignAgent(agentId: string) {
    if (!selected) return
    const res = await fetch(`/api/admin/inbox/conversations/${selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedToId: agentId || null }),
    })
    const data = await res.json()
    if (res.ok) {
      const agent = agents.find((a) => a.id === agentId) || null
      setSelected((prev) => prev ? { ...prev, assignedToId: agentId || null, assignedTo: agent } : prev)
      setConversations((prev) => prev.map((c) => c.id === selected.id ? { ...c, assignedToId: agentId || null, assignedTo: agent } : c))
    }
  }

  // ── Tags ─────────────────────────────────────────────────────────────────

  async function toggleTag(tag: string) {
    if (!selected) return
    const current = selected.tags || []
    const tags = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]
    const res = await fetch(`/api/admin/inbox/conversations/${selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    })
    if (res.ok) {
      setSelected((prev) => prev ? { ...prev, tags } : prev)
      setConversations((prev) => prev.map((c) => c.id === selected.id ? { ...c, tags } : c))
    }
  }

  // ── Profile modal ────────────────────────────────────────────────────────

  const [profileModal, setProfileModal] = useState<QuickProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [magicLinkTarget, setMagicLinkTarget] = useState<{ id: string; name: string; isPartner: boolean } | null>(null)

  async function openProfile(userId: string) {
    setProfileLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`)
      const data = await res.json()
      if (res.ok) setProfileModal(data.user)
    } finally {
      setProfileLoading(false)
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)
  const isInternal = isInternalNote

  const filteredMessages = (selected?.messages || []).filter((m) =>
    !msgSearch || m.body.toLowerCase().includes(msgSearch.toLowerCase())
  )

  const windowClosed = selected?.channel === 'WHATSAPP' && isWaWindowClosed(selected?.messages || [])

  const cannedFiltered = cannedResponses.filter((r) =>
    !cannedSearch || r.title.toLowerCase().includes(cannedSearch.toLowerCase()) || r.body.toLowerCase().includes(cannedSearch.toLowerCase())
  )
  const cannedByCategory = cannedFiltered.reduce<Record<string, CannedResponse[]>>((acc, r) => {
    const cat = r.category || 'General'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(r)
    return acc
  }, {})

  function insertEmoji(emoji: string) {
    const el = inputRef.current
    if (!el) { setMessageText((prev) => prev + emoji); return }
    const start = el.selectionStart ?? messageText.length
    const end = el.selectionEnd ?? messageText.length
    const next = messageText.slice(0, start) + emoji + messageText.slice(end)
    setMessageText(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + emoji.length, start + emoji.length)
    })
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[100dvh] bg-gray-50 overflow-hidden">

      {/* ── Left sidebar: conversation list ── */}
      <aside className={`flex flex-col w-full md:w-80 shrink-0 border-r bg-white ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}`}>

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

          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
            <input
              className="w-full border rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Buscar nombre, teléfono…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-1.5 flex-wrap">
            <select className="border rounded px-2 py-1 text-xs flex-1 min-w-0" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as ConvStatus | '')}>
              <option value="">Todos</option>
              {(Object.keys(STATUS_LABELS) as ConvStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <select className="border rounded px-2 py-1 text-xs flex-1 min-w-0" value={filterChannel} onChange={(e) => setFilterChannel(e.target.value as Channel | '')}>
              <option value="">Canal</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="SMS">SMS</option>
            </select>
            <select className="border rounded px-2 py-1 text-xs flex-1 min-w-0" value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}>
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
          {conversations.map((conv) => {
            const sla = slaLabel(conv)
            return (
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
                <div className="flex items-center gap-1.5 mt-1 pl-4 flex-wrap">
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[conv.status]}`}>{STATUS_LABELS[conv.status]}</span>
                  {sla && (
                    <span className={`text-[10px] font-medium ${sla.level === 'critical' ? 'text-red-600' : 'text-orange-500'}`}>
                      · {sla.label}
                    </span>
                  )}
                  {conv.tags?.slice(0, 2).map((tag) => (
                    <span key={tag} className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${tagColor(tag)}`}>{tag}</span>
                  ))}
                  {conv.assignedTo && (
                    <span className="text-[10px] text-gray-400 truncate ml-auto">· {conv.assignedTo.name}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </aside>

      {/* ── Right: chat view ── */}
      <div className={`flex flex-col flex-1 min-w-0 ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>

        {!selected ? (
          <div className="flex flex-col items-center justify-center flex-1 text-gray-400 gap-3">
            <MessageSquare className="h-16 w-16 opacity-20" />
            <p className="text-sm">Selecciona una conversación para comenzar</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-3 md:px-5 py-3 border-b bg-white space-y-2">
              <div className="flex items-center gap-2 md:gap-3">
                {/* Back button — mobile only */}
                <button
                  onClick={() => setMobileView('list')}
                  className="md:hidden shrink-0 rounded-lg p-1.5 hover:bg-gray-100 text-gray-500"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
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

                {/* In-conversation search */}
                <button
                  onClick={() => { setShowMsgSearch((v) => !v); setMsgSearch('') }}
                  className={`rounded-lg p-1.5 transition ${showMsgSearch ? 'bg-primary-100 text-primary-600' : 'hover:bg-gray-100 text-gray-400'}`}
                  title="Buscar en conversación (Ctrl+F)"
                >
                  <Search className="h-4 w-4" />
                </button>

                {/* Agent selector */}
                <div className="hidden sm:flex items-center gap-1 shrink-0">
                  <Users className="h-3.5 w-3.5 text-gray-400" />
                  <select className="border rounded-lg px-2 py-1 text-xs" value={selected.assignedToId || ''} onChange={(e) => assignAgent(e.target.value)}>
                    <option value="">Sin asignar</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>

                {/* Status — dropdown on mobile, buttons on desktop */}
                <div className="shrink-0 sm:hidden">
                  <select
                    value={selected.status}
                    onChange={(e) => updateStatus(e.target.value as ConvStatus)}
                    className="border rounded-lg px-2 py-1 text-xs"
                  >
                    {(Object.keys(STATUS_LABELS) as ConvStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div className="hidden sm:flex items-center gap-1 shrink-0">
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

              {/* Tags row */}
              <div className="flex items-center gap-1.5 flex-wrap pl-2 md:pl-12">
                {(selected.tags || []).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border transition hover:opacity-70 ${tagColor(tag)}`}
                  >
                    {tag}
                    <X className="h-3 w-3" />
                  </button>
                ))}
                <div className="relative">
                  <button
                    onClick={() => setShowTagPicker((v) => !v)}
                    className="flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-400 hover:border-gray-500 hover:text-gray-600 transition"
                  >
                    <Tag className="h-3 w-3" />
                    Etiqueta
                  </button>
                  {showTagPicker && (
                    <div className="absolute top-7 left-0 z-20 bg-white border rounded-xl shadow-lg p-2 flex flex-wrap gap-1.5 w-56">
                      {PRESET_TAGS.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => { toggleTag(tag); setShowTagPicker(false) }}
                          className={`rounded-full px-2 py-0.5 text-xs font-medium border transition ${(selected.tags || []).includes(tag) ? tagColor(tag) + ' opacity-50' : tagColor(tag)}`}
                        >
                          {(selected.tags || []).includes(tag) ? '✓ ' : ''}{tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* In-conversation search bar */}
              {showMsgSearch && (
                <div className="flex items-center gap-2 pl-2 md:pl-12">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                    <input
                      autoFocus
                      className="w-full border rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="Buscar en mensajes…"
                      value={msgSearch}
                      onChange={(e) => setMsgSearch(e.target.value)}
                    />
                  </div>
                  {msgSearch && (
                    <span className="text-xs text-gray-400">
                      {filteredMessages.length} resultado{filteredMessages.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* User info bar */}
            {selected.user && (
              <div className="flex flex-wrap items-center gap-2 px-3 md:px-5 py-2 bg-amber-50 border-b text-xs text-amber-800">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate max-w-[200px] md:max-w-none"><b>{selected.user.name}</b> · {selected.user.email} · {selected.user.role}</span>
                {selected.user.phone && <span className="hidden sm:flex items-center gap-1"><Phone className="h-3 w-3" />{selected.user.phone}</span>}
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => setMagicLinkTarget({
                      id: selected.user!.id,
                      name: selected.user!.name,
                      isPartner: selected.user!.role === 'PARTNER',
                    })}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 hover:bg-amber-200 transition text-xs font-medium"
                  >
                    <Link2 className="h-3 w-3" /> Magic Link
                  </button>
                  <button
                    onClick={() => openProfile(selected.user!.id)}
                    disabled={profileLoading}
                    className="underline opacity-70 hover:opacity-100 flex items-center gap-1 disabled:opacity-40"
                  >
                    {profileLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                    Ver perfil →
                  </button>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 md:px-5 py-4 space-y-4">
              {/* Load more */}
              {hasMore && (
                <div className="flex justify-center">
                  <button
                    onClick={loadMoreMessages}
                    disabled={loadingMore}
                    className="flex items-center gap-1.5 rounded-lg border px-4 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition disabled:opacity-40"
                  >
                    {loadingMore ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ChevronUp className="h-3 w-3" />}
                    Cargar mensajes anteriores
                  </button>
                </div>
              )}

              {groupedMessages(filteredMessages).map((group) => (
                <div key={group.date}>
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 shrink-0">{group.date}</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  <div className="space-y-2">
                    {group.msgs.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
                        {msg.isInternal ? (
                          // Internal note
                          <div className="max-w-[75%] rounded-2xl px-4 py-2.5 bg-yellow-50 border border-yellow-200 rounded-br-sm">
                            <div className="flex items-center gap-1 mb-1">
                              <StickyNote className="h-3 w-3 text-yellow-600" />
                              <span className="text-[10px] text-yellow-700 font-medium">Nota interna</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap break-words text-gray-700">{msg.body}</p>
                            <div className="flex items-center gap-1 mt-1 justify-end">
                              <span className="text-[11px] text-yellow-600">
                                {formatTime(msg.sentAt)}{msg.sentBy ? ` · ${msg.sentBy.name}` : ''}
                              </span>
                            </div>
                          </div>
                        ) : (
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
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {filteredMessages.length === 0 && msgSearch && (
                <div className="flex items-center justify-center h-20 text-sm text-gray-400">
                  Sin resultados para "{msgSearch}"
                </div>
              )}
              {(selected.messages || []).length === 0 && !msgSearch && (
                <div className="flex items-center justify-center h-32 text-sm text-gray-400">Sin mensajes aún</div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Error banner */}
            {error && (
              <div className="mx-3 md:mx-5 mb-2 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="flex-1">{error}</span>
                <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
              </div>
            )}

            {/* Canned responses picker */}
            {showCannedPicker && (
              <div className="mx-3 md:mx-5 mb-2 rounded-xl border bg-white shadow-lg max-h-60 overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 px-3 py-2 border-b">
                  <Search className="h-3.5 w-3.5 text-gray-400" />
                  <input
                    autoFocus
                    className="flex-1 text-sm outline-none"
                    placeholder="Buscar respuesta…"
                    value={cannedSearch}
                    onChange={(e) => setCannedSearch(e.target.value)}
                  />
                  <button onClick={() => setShowCannedPicker(false)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                </div>
                <div className="overflow-y-auto flex-1">
                  {Object.entries(cannedByCategory).map(([cat, responses]) => (
                    <div key={cat}>
                      <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50">{cat}</p>
                      {responses.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => { setMessageText(r.body); setShowCannedPicker(false); setCannedSearch(''); inputRef.current?.focus() }}
                          className="w-full text-left px-3 py-2 hover:bg-primary-50 transition"
                        >
                          <p className="text-sm font-medium text-gray-800">{r.title}</p>
                          <p className="text-xs text-gray-500 truncate">{r.body}</p>
                        </button>
                      ))}
                    </div>
                  ))}
                  {cannedFiltered.length === 0 && (
                    <p className="px-3 py-4 text-sm text-gray-400 text-center">Sin respuestas guardadas</p>
                  )}
                </div>
              </div>
            )}

            {/* Closed notice */}
            {selected.status === 'CLOSED' ? (
              <div className="mx-3 md:mx-5 mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 text-center">
                Conversación cerrada.{' '}
                <button className="underline text-primary-600" onClick={() => updateStatus('OPEN')}>Reabrir</button>
              </div>
            ) : (
              /* Message input */
              <div className="px-3 md:px-5 pb-4 pt-2 border-t bg-white">
                {/* Mode indicator */}
                {isInternalNote && (
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <StickyNote className="h-3.5 w-3.5 text-yellow-600" />
                    <span className="text-xs font-medium text-yellow-700">Nota interna — no se envía al contacto</span>
                  </div>
                )}

                {/* WA window blocked notice */}
                {windowClosed && !isInternalNote && !showTemplatePicker && (
                  <div className="mb-2 flex items-center gap-2 rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-yellow-600" />
                    <span className="flex-1">Ventana de 24h cerrada. Debes usar una plantilla de WhatsApp para retomar.</span>
                    <button
                      onClick={loadWaTemplates}
                      className="shrink-0 rounded-lg bg-yellow-600 px-3 py-1 text-xs font-semibold text-white hover:bg-yellow-700 transition flex items-center gap-1"
                    >
                      <LayoutTemplate className="h-3 w-3" />
                      Usar plantilla
                    </button>
                  </div>
                )}

                {/* WA Template picker — only here, at the bottom */}
                {showTemplatePicker && (
                  <div className="mb-2 rounded-xl border bg-white shadow-sm">
                    <div className="flex items-center justify-between px-3 py-2 border-b">
                      <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                        <LayoutTemplate className="h-4 w-4" /> Plantillas de WhatsApp
                      </span>
                      <button onClick={() => { setShowTemplatePicker(false); setSelectedTemplate(null) }} className="text-gray-400 hover:text-gray-600">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="p-3 max-h-48 overflow-y-auto space-y-1.5">
                      {waTemplates.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-3">No hay plantillas aprobadas</p>
                      )}
                      {waTemplates.map((t) => (
                        <button
                          key={t.sid}
                          onClick={() => { setSelectedTemplate(t); setTemplateVars({}) }}
                          className={`w-full text-left rounded-lg border p-2.5 text-sm transition ${selectedTemplate?.sid === t.sid ? 'border-primary-400 bg-primary-50' : 'hover:border-gray-300 hover:bg-gray-50'}`}
                        >
                          <p className="font-medium text-gray-800">{t.name}</p>
                          <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">{t.body}</p>
                        </button>
                      ))}
                    </div>
                    {selectedTemplate && (
                      <div className="px-3 pb-3 space-y-2 border-t pt-3">
                        <p className="text-xs font-semibold text-gray-600">Variables</p>
                        {Object.keys(selectedTemplate.variables).map((key) => (
                          <div key={key} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-8 shrink-0">{`{{${key}}}`}</span>
                            <input
                              className="flex-1 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                              placeholder={`Valor para ${key}`}
                              value={templateVars[key] || ''}
                              onChange={(e) => setTemplateVars((prev) => ({ ...prev, [key]: e.target.value }))}
                            />
                          </div>
                        ))}
                        <button
                          onClick={sendTemplate}
                          disabled={sending}
                          className="w-full rounded-lg bg-green-600 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40 transition"
                        >
                          {sending ? 'Enviando…' : 'Enviar plantilla'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className={`relative flex items-end gap-2 rounded-2xl border px-4 py-2 transition ${
                  windowClosed && !isInternalNote
                    ? 'bg-gray-100 border-gray-200 opacity-60 pointer-events-none select-none'
                    : isInternalNote ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50'
                }`}>
                  {/* Canned responses */}
                  <button
                    onClick={() => setShowCannedPicker((v) => !v)}
                    className={`shrink-0 rounded-lg p-1.5 transition ${showCannedPicker ? 'bg-primary-100 text-primary-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                    title="Respuestas rápidas"
                  >
                    <Zap className="h-4 w-4" />
                  </button>

                  {/* Internal note toggle */}
                  <button
                    onClick={() => setIsInternalNote((v) => !v)}
                    className={`shrink-0 rounded-lg p-1.5 transition ${isInternalNote ? 'bg-yellow-100 text-yellow-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                    title="Nota interna"
                  >
                    <StickyNote className="h-4 w-4" />
                  </button>

                  {/* Emoji picker button */}
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setShowEmojiPicker((v) => !v)}
                      className={`rounded-lg p-1.5 transition text-base leading-none ${showEmojiPicker ? 'bg-primary-100' : 'text-gray-400 hover:bg-gray-100'}`}
                      title="Emojis"
                    >
                      😊
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute bottom-10 left-0 z-30 w-64 max-w-[85vw] rounded-2xl border bg-white shadow-xl p-2 overflow-hidden">
                        <div className="flex flex-wrap max-h-52 overflow-y-auto overflow-x-hidden">
                          {[
                            '😊','😄','😂','🤣','😍','🥰','😘','🤩',
                            '👍','👏','🙌','🙏','💪','✅','🔥','⭐',
                            '❤️','💙','💚','💛','🧡','💜','🖤','🤍',
                            '😅','😬','🤔','😮','😱','😢','😭','🥺',
                            '🎉','🎊','🎁','🏆','🥇','💯','✨','🌟',
                            '📞','📱','💬','📩','📋','📌','🔔','⏰',
                            '👋','🤝','💼','🏠','🚗','🛒','💰','💳',
                            '✔️','❌','⚠️','ℹ️','🔒','🔓','📊','📈',
                          ].map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => { insertEmoji(emoji); setShowEmojiPicker(false) }}
                              className="flex items-center justify-center h-8 w-8 rounded-lg text-xl hover:bg-gray-100 transition shrink-0"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5 text-xs text-gray-500 pb-1">
                    <span className={`rounded-full w-2 h-2 ${CHANNEL_COLOR[selected.channel]}`} />
                    {selected.channel}
                  </div>

                  <textarea
                    ref={inputRef}
                    className="flex-1 bg-transparent resize-none text-sm outline-none min-h-[36px] max-h-32 py-1"
                    placeholder={isInternalNote ? 'Escribe una nota interna…' : windowClosed ? 'Ventana cerrada — usa una plantilla' : `Escribe un mensaje por ${selected.channel === 'WHATSAPP' ? 'WhatsApp' : 'SMS'}…`}
                    value={messageText}
                    rows={1}
                    disabled={windowClosed && !isInternalNote}
                    onChange={(e) => {
                      setMessageText(e.target.value)
                      e.target.style.height = 'auto'
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
                    }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!messageText.trim() || sending || (windowClosed && !isInternalNote)}
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

      {/* ── Quick Profile Modal ── */}
      {profileModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setProfileModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-4 p-5 border-b">
              <div className="h-14 w-14 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xl shrink-0 overflow-hidden">
                {profileModal.image
                  ? <img src={profileModal.image} alt="" className="h-full w-full object-cover" />
                  : profileModal.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-gray-900 text-lg leading-tight">{profileModal.name}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${profileModal.role === 'PARTNER' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {profileModal.role === 'PARTNER' ? 'Socio' : 'Cliente'}
                  </span>
                  {!profileModal.isActive && <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">Inactivo</span>}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{profileModal.email}</p>
                {profileModal.phone && (
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                    <Phone className="h-3 w-3" />{profileModal.phone}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Desde {new Date(profileModal.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => setProfileModal(null)}
                className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 p-5 pb-0">
              <div className="rounded-xl bg-gray-50 p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{profileModal._count.bookings}</p>
                <p className="text-xs text-gray-500">Reservas</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{profileModal.completedServicesCount}</p>
                <p className="text-xs text-gray-500">Completados</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 text-center">
                {profileModal.partnerProfile ? (
                  <>
                    <p className="text-lg font-bold text-gray-900 flex items-center justify-center gap-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                      {profileModal.partnerProfile.rating.toFixed(1)}
                    </p>
                    <p className="text-xs text-gray-500">{profileModal.partnerProfile.totalReviews} reseñas</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold text-gray-900 flex items-center justify-center gap-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                      {profileModal.clientRating.toFixed(1)}
                    </p>
                    <p className="text-xs text-gray-500">{profileModal.clientTotalReviews} reseñas</p>
                  </>
                )}
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Partner info */}
              {profileModal.partnerProfile && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Perfil de Socio</h3>
                  <div className="rounded-xl border p-3 space-y-2 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="text-gray-700">{profileModal.partnerProfile.city || '—'}</span>
                      {profileModal.partnerProfile.verified && (
                        <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5 text-xs font-medium">
                          <ShieldCheck className="h-3 w-3" />Verificado
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${profileModal.partnerProfile.isAvailable ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {profileModal.partnerProfile.isAvailable ? 'Disponible' : 'No disponible'}
                      </span>
                    </div>
                    {profileModal.partnerProfile.profileHeadline && (
                      <p className="text-gray-600 italic">"{profileModal.partnerProfile.profileHeadline}"</p>
                    )}
                    {profileModal.partnerProfile.services.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {profileModal.partnerProfile.services.map((s, i) => (
                          <span key={i} className="rounded-full bg-primary-50 text-primary-700 px-2 py-0.5 text-xs">{s.service.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {profileModal.partnerProfile.documents.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {profileModal.partnerProfile.documents.map((doc, i) => (
                        <span key={i} className={`rounded-full px-2 py-0.5 text-xs font-medium ${doc.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : doc.status === 'PENDING' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
                          {doc.type.replace(/_/g, ' ')} {doc.status === 'APPROVED' ? '✓' : doc.status === 'PENDING' ? '⏳' : '✗'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Addresses */}
              {profileModal.addresses.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Direcciones</h3>
                  <div className="space-y-1.5">
                    {profileModal.addresses.slice(0, 3).map((addr, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm rounded-lg border px-3 py-2">
                        <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                        <div>
                          {addr.label && <p className="font-medium text-gray-700">{addr.label}</p>}
                          <p className="text-xs text-gray-500">{addr.street}, {addr.neighborhood} · {addr.city}</p>
                        </div>
                        {addr.isPrimary && <span className="ml-auto text-xs text-primary-600 font-medium">Principal</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Last bookings */}
              {profileModal.bookings.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Últimas reservas</h3>
                  <div className="space-y-1.5">
                    {profileModal.bookings.slice(0, 4).map((b) => (
                      <div key={b.id} className="flex items-center gap-2 text-sm rounded-lg border px-3 py-2">
                        <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-700 truncate">{b.service.name}</p>
                          <p className="text-xs text-gray-400">{new Date(b.scheduledDate).toLocaleDateString('es-CO')} {b.scheduledTime}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-gray-700">${b.totalPrice.toLocaleString('es-CO')}</p>
                          <span className={`text-[10px] font-medium ${b.status === 'COMPLETED' ? 'text-emerald-600' : b.status === 'CANCELLED' ? 'text-red-500' : 'text-blue-600'}`}>
                            {b.status === 'COMPLETED' ? 'Completado' : b.status === 'CANCELLED' ? 'Cancelado' : b.status === 'CONFIRMED' ? 'Confirmado' : 'Pendiente'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer CTA */}
            <div className="px-5 pb-5 space-y-2">
              <button
                onClick={() => setMagicLinkTarget({
                  id: profileModal.id,
                  name: profileModal.name,
                  isPartner: !!profileModal.partnerProfile,
                })}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-primary-300 text-primary-700 bg-primary-50 text-sm font-semibold hover:bg-primary-100 transition"
              >
                <Link2 className="h-4 w-4" />
                Generar Magic Link
              </button>
              <a
                href={`/admin/users/${profileModal.id}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-secondary-500 text-white text-sm font-semibold hover:opacity-90 transition"
              >
                <ExternalLink className="h-4 w-4" />
                Ver perfil completo
              </a>
            </div>
          </div>
        </div>
      )}

      {magicLinkTarget && (
        <InboxMagicLinkModal
          userId={magicLinkTarget.id}
          userName={magicLinkTarget.name}
          isPartner={magicLinkTarget.isPartner}
          onClose={() => setMagicLinkTarget(null)}
        />
      )}
    </div>
  )
}

// ─── Magic Link Modal ────────────────────────────────────────────────────────

const REDIRECT_OPTIONS = [
  { value: '/partner/dashboard', label: 'Inicio del socio' },
  { value: '/partner/verification', label: 'Verificación de documentos' },
  { value: '/app', label: 'App del socio' },
  { value: '/dashboard', label: 'Inicio del cliente' },
  { value: '/', label: 'Inicio (homepage)' },
  { value: '__custom__', label: 'URL personalizada…' },
]

function InboxMagicLinkModal({
  userId, userName, isPartner, onClose,
}: {
  userId: string
  userName: string
  isPartner: boolean
  onClose: () => void
}) {
  const defaultRedirect = isPartner ? '/partner/dashboard' : '/dashboard'
  const [redirectUrl, setRedirectUrl] = useState(defaultRedirect)
  const [customUrl, setCustomUrl] = useState('')
  const [requirePasswordChange, setRequirePasswordChange] = useState(false)
  const [loading, setLoading] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const finalUrl = redirectUrl === '__custom__' ? customUrl : redirectUrl

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/magic/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: [userId], redirectUrl: finalUrl, requirePasswordChange }),
      })
      const data = await res.json()
      if (!res.ok || !data.tokens?.length) {
        setError(data.error ?? 'Error al generar el enlace')
        return
      }
      setGeneratedUrl(data.tokens[0].url)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    if (!generatedUrl) return
    await navigator.clipboard.writeText(generatedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary-600" />
            <h2 className="font-semibold text-gray-900">Generar Magic Link</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-500">
            Enlace de ingreso único para <span className="font-medium text-gray-800">{userName}</span>. Expira en 72 horas.
          </p>

          {!generatedUrl ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Destino después del login</label>
                <select
                  value={redirectUrl}
                  onChange={e => setRedirectUrl(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                >
                  {REDIRECT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {redirectUrl === '__custom__' && (
                  <input
                    type="text"
                    placeholder="ej. /partner/services"
                    value={customUrl}
                    onChange={e => setCustomUrl(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                )}
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requirePasswordChange}
                  onChange={e => setRequirePasswordChange(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-300"
                />
                <span className="text-sm text-gray-700">Pedir cambio de contraseña al ingresar</span>
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                onClick={generate}
                disabled={loading || (redirectUrl === '__custom__' && !customUrl.trim())}
                className="w-full py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading
                  ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  : <Link2 className="h-4 w-4" />}
                {loading ? 'Generando…' : 'Generar enlace'}
              </button>
            </>
          ) : (
            <>
              <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Enlace generado</span>
                </div>
                <p className="text-xs font-mono text-green-700 break-all">{generatedUrl}</p>
              </div>

              <button
                onClick={copy}
                className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  copied ? 'bg-green-100 text-green-800' : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? '¡Copiado!' : 'Copiar enlace'}
              </button>

              <button
                onClick={() => { setGeneratedUrl(null); setError(null) }}
                className="w-full py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Generar otro
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

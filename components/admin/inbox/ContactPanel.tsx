'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Link2, Loader2, MessageCircle, Save, Search, ShieldCheck, Unlink, User, X } from 'lucide-react'
import { ChannelIcon, CHANNEL_META } from '@/components/admin/ChannelIcon'

export type ContactDetail = {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  notes: string | null
  userId: string | null
  identities: Array<{ id: string; channel: string; externalId: string }>
  conversations: Array<{ id: string; channel: string; status: string; lastMessageAt: string | null; connection?: { name: string } | null }>
  user: {
    id: string; name: string; email: string; phone: string | null; image?: string | null; role: string; isActive: boolean; createdAt: string
    partnerProfile: { verified: boolean; isActive: boolean; city: string; rating: number; totalReviews: number } | null
    _count: { bookings: number; serviceRequests: number }
  } | null
}

type SearchUser = { id: string; name: string; email: string; phone: string | null; role: string; isActive: boolean; partnerProfile: { verified: boolean; city: string } | null }

const ROLE: Record<string, string> = { CLIENT: 'Cliente', PARTNER: 'Socio', ADMIN: 'Equipo' }
const input = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm'

export function RoleBadge({ user }: { user: { role: string; partnerProfile?: { verified: boolean } | null } }) {
  const partner = user.role === 'PARTNER'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${partner ? 'bg-orange-100 text-orange-800' : user.role === 'CLIENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'}`}>
      {partner && user.partnerProfile?.verified && <ShieldCheck className="h-3 w-3" />}
      {ROLE[user.role] || user.role}{partner ? (user.partnerProfile?.verified ? ' verificado' : ' sin verificar') : ''}
    </span>
  )
}

export default function ContactPanel({
  contact, currentConversationId, onClose, onChanged, onOpenConversation, onOpenProfile,
}: {
  contact: ContactDetail
  currentConversationId: string
  onClose: () => void
  onChanged: (contact: ContactDetail) => void
  onOpenConversation: (id: string) => void
  onOpenProfile: (userId: string) => void
}) {
  const [form, setForm] = useState({ name: contact.name || '', phone: contact.phone || '', email: contact.email || '', notes: contact.notes || '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchUser[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    setForm({ name: contact.name || '', phone: contact.phone || '', email: contact.email || '', notes: contact.notes || '' })
  }, [contact.id, contact.name, contact.phone, contact.email, contact.notes])

  useEffect(() => {
    if (query.trim().length < 3) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/admin/inbox/users/search?q=${encodeURIComponent(query.trim())}`)
        const data = await res.json().catch(() => ({}))
        setResults(data.users || [])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const dirty = form.name !== (contact.name || '') || form.phone !== (contact.phone || '') || form.email !== (contact.email || '') || form.notes !== (contact.notes || '')

  async function patch(body: Record<string, unknown>, okMessage: string) {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/admin/inbox/contacts/${contact.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar')
      onChanged(data.contact)
      setNotice(okMessage)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function openWhatsApp() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/inbox/contacts/${contact.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'whatsapp' }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo abrir WhatsApp')
      onOpenConversation(data.conversationId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const waConversation = contact.conversations.find((c) => c.channel === 'WHATSAPP')

  return (
    <aside className="absolute inset-y-0 right-0 z-30 w-full sm:w-[380px] bg-white border-l shadow-xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2"><User className="h-4 w-4" /> Contacto</h3>
        <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-sm">
        {error && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"><AlertCircle className="h-3.5 w-3.5" /> {error}</div>}
        {notice && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> {notice}</div>}

        {/* Who is this */}
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 shrink-0 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xl font-bold overflow-hidden">
            {contact.user?.image
              ? <img src={contact.user.image} alt="" className="h-full w-full object-cover" />
              : (contact.name || contact.user?.name || '?').replace(/^[@+]/, '').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{contact.name || contact.user?.name || 'Sin nombre'}</p>
            {contact.user ? <RoleBadge user={contact.user} /> : <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">Sin cuenta en la plataforma</span>}
          </div>
        </div>

        {/* Data */}
        <div className="space-y-2.5">
          <label className="block space-y-1"><span className="text-xs text-gray-500">Nombre</span><input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre del contacto" /></label>
          <label className="block space-y-1">
            <span className="text-xs text-gray-500">Teléfono (WhatsApp)</span>
            <input className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+57 300 123 4567" inputMode="tel" />
            <span className="block text-[11px] text-gray-400">Con el teléfono el contacto queda reconocido cuando escriba por WhatsApp y puedes escribirle tú por ahí.</span>
          </label>
          <label className="block space-y-1"><span className="text-xs text-gray-500">Correo</span><input className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="correo@ejemplo.com" inputMode="email" /></label>
          <label className="block space-y-1"><span className="text-xs text-gray-500">Notas del equipo</span><textarea className={input} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Lo que conviene saber de esta persona" /></label>
          <button
            onClick={() => patch({ name: form.name, phone: form.phone, email: form.email, notes: form.notes }, 'Contacto guardado.')}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Guardar
          </button>
        </div>

        {/* Platform user */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-700">Usuario en la plataforma</p>
          {contact.user ? (
            <div className="rounded-xl border border-gray-200 p-3 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900">{contact.user.name}</span>
                <RoleBadge user={contact.user} />
                {!contact.user.isActive && <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[11px]">Cuenta inactiva</span>}
              </div>
              <p className="text-xs text-gray-500">{contact.user.email}{contact.user.phone ? ` · ${contact.user.phone}` : ''}</p>
              <p className="text-xs text-gray-500">
                {contact.user.role === 'PARTNER' && contact.user.partnerProfile
                  ? `${contact.user.partnerProfile.city} · ${contact.user.partnerProfile.totalReviews ? `${contact.user.partnerProfile.rating.toFixed(1)} ★ (${contact.user.partnerProfile.totalReviews})` : 'sin reseñas'}`
                  : `${contact.user._count.bookings} reserva(s) · ${contact.user._count.serviceRequests} solicitud(es)`}
                {' · desde '}{new Date(contact.user.createdAt).toLocaleDateString('es-CO')}
              </p>
              <div className="flex gap-3 text-xs pt-1">
                <button onClick={() => onOpenProfile(contact.user!.id)} className="text-primary-600 hover:underline">Ver perfil completo</button>
                <button onClick={() => patch({ userId: null }, 'Usuario desvinculado.')} className="inline-flex items-center gap-1 text-gray-500 hover:underline"><Unlink className="h-3 w-3" /> Desvincular</button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">No está vinculado a ninguna cuenta. Busca por nombre, correo o teléfono para saber si es cliente o socio.</p>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <input className={`${input} pl-8`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar usuario…" />
                {searching && <Loader2 className="absolute right-2.5 top-2.5 h-3.5 w-3.5 animate-spin text-gray-400" />}
              </div>
              {results.length > 0 && (
                <div className="rounded-xl border border-gray-200 divide-y">
                  {results.map((u) => (
                    <button key={u.id} onClick={() => patch({ userId: u.id }, `Vinculado a ${u.name}.`)} className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2">
                      <span className="flex-1 min-w-0">
                        <span className="block text-gray-900 truncate">{u.name}</span>
                        <span className="block text-[11px] text-gray-500 truncate">{u.email}{u.phone ? ` · ${u.phone}` : ''}</span>
                      </span>
                      <RoleBadge user={u} />
                      <Link2 className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                  ))}
                </div>
              )}
              {query.trim().length >= 3 && !searching && results.length === 0 && <p className="text-[11px] text-gray-400">Sin resultados.</p>}
            </div>
          )}
        </div>

        {/* Channels */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-700">Canales de este contacto</p>
          <div className="rounded-xl border border-gray-200 divide-y">
            {contact.conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => c.id !== currentConversationId && onOpenConversation(c.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs ${c.id === currentConversationId ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
              >
                <ChannelIcon channel={c.channel} size={16} />
                <span className="flex-1 min-w-0">
                  <span className="block text-gray-900">{CHANNEL_META[c.channel]?.label ?? c.channel}{c.connection?.name ? ` · ${c.connection.name}` : ''}</span>
                  <span className="block text-[11px] text-gray-500">{c.lastMessageAt ? `último mensaje ${new Date(c.lastMessageAt).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'sin mensajes'}</span>
                </span>
                {c.id === currentConversationId ? <span className="text-[10px] text-primary-700">actual</span> : <MessageCircle className="h-3.5 w-3.5 text-gray-400" />}
              </button>
            ))}
            {contact.identities.filter((i) => !contact.conversations.some((c) => c.channel === i.channel)).map((i) => (
              <div key={i.id} className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500">
                <ChannelIcon channel={i.channel} size={16} /> {CHANNEL_META[i.channel]?.label ?? i.channel} · {i.externalId}
              </div>
            ))}
          </div>
          {!waConversation && (
            <button onClick={openWhatsApp} disabled={saving || !contact.phone} title={contact.phone ? '' : 'Guarda primero el teléfono'} className="inline-flex items-center gap-1.5 rounded-xl border border-[#25D366] px-3 py-1.5 text-xs font-semibold text-[#128C4B] hover:bg-[#25D366]/10 disabled:opacity-50">
              <ChannelIcon channel="WHATSAPP" size={14} /> Escribir por WhatsApp
            </button>
          )}
          {!waConversation && !contact.phone && <p className="text-[11px] text-gray-400">Guarda un teléfono para escribirle por WhatsApp.</p>}
        </div>
      </div>
    </aside>
  )
}

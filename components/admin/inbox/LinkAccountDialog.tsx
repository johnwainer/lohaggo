'use client'

import { useEffect, useState } from 'react'
import { Link2, Loader2, Search, X } from 'lucide-react'
import { useDialog } from '@/components/ui/use-dialog'
import { RoleBadge } from '@/components/admin/inbox/ContactPanel'

type SearchUser = { id: string; name: string; email: string; phone: string | null; role: string; isActive: boolean; partnerProfile: { verified: boolean; city: string } | null }

/** Links the conversation to a client or partner account found by name, phone or email. */
export default function LinkAccountDialog({ open, conversationId, onClose, onLinked }: {
  open: boolean
  conversationId: string
  onClose: () => void
  onLinked: (data: { user: unknown; contact: unknown }) => void
}) {
  const { dialogProps, titleId } = useDialog(open, onClose)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchUser[]>([])
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (open) { setQuery(''); setResults([]); setError(null) } }, [open])

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

  async function link(u: SearchUser) {
    setBusy(u.id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/inbox/conversations/${conversationId}/link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: u.id }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo vincular')
      onLinked(data)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo vincular')
    } finally {
      setBusy(null)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div {...dialogProps} className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-xl focus:outline-none">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-bold text-gray-900">Vincular a una cuenta</h2>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-1 text-sm text-gray-600">Busca al cliente o socio por nombre, teléfono o correo. Las cuentas del equipo no se pueden vincular a un chat.</p>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            autoFocus
            className="w-full rounded-xl border border-gray-200 pl-9 pr-9 py-2 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Nombre, teléfono o correo…"
            aria-label="Buscar cuenta"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />}
        </div>
        {error && <p role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        {results.length > 0 && (
          <div className="mt-3 rounded-xl border border-gray-200 divide-y">
            {results.map((u) => (
              <button key={u.id} onClick={() => link(u)} disabled={busy !== null} className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-60">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-gray-900 truncate">{u.name}{!u.isActive && <span className="ml-1 text-[11px] text-red-600">(inactiva)</span>}</span>
                  <span className="block text-[11px] text-gray-500 truncate">{u.email}{u.phone ? ` · ${u.phone}` : ''}</span>
                </span>
                <RoleBadge user={u} />
                {busy === u.id ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : <Link2 className="h-4 w-4 text-gray-400" />}
              </button>
            ))}
          </div>
        )}
        {query.trim().length >= 3 && !searching && results.length === 0 && <p className="mt-2 text-xs text-gray-400">Sin resultados.</p>}
      </div>
    </div>
  )
}

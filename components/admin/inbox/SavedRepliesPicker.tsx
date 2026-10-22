'use client'

import { useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { fillReplyVariables, usesVariable } from '@/lib/inbox/saved-replies'

type SavedReply = { id: string; title: string; body: string; category?: string | null }
type Form = { id: string | null; title: string; body: string; category: string }

const input = 'w-full min-w-0 rounded-xl border border-gray-200 px-3 py-1.5 text-base md:text-sm focus:outline-none focus:ring-1 focus:ring-primary-500'

/**
 * «Respuestas guardadas» of the team (shared by everyone in the inbox). Inserting one fills {nombre} with the
 * contact's first name and {ref} with their latest booking (or open request).
 */
export default function SavedRepliesPicker({ conversationId, contactName, onInsert, onClose }: {
  conversationId: string
  contactName: string | null
  onInsert: (text: string) => void
  onClose: () => void
}) {
  const [replies, setReplies] = useState<SavedReply[] | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/admin/inbox/canned-responses')
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'No se pudieron cargar')
      setReplies(d.responses || [])
    } catch (err) {
      setReplies([])
      setError(err instanceof Error ? err.message : 'No se pudieron cargar')
    }
  }

  useEffect(() => { load() }, [])

  async function insert(r: SavedReply) {
    let ref: string | null = null
    if (usesVariable(r.body, 'ref')) {
      setBusy(true)
      try {
        const res = await fetch(`/api/admin/inbox/conversations/${conversationId}/bookings`)
        const d = await res.json().catch(() => ({}))
        const bookings = (d.bookings || []) as { ref: string }[]
        ref = bookings[bookings.length - 1]?.ref ?? (d.requests || [])[0]?.ref ?? null
      } catch { /* the placeholder stays for the person to fill */ } finally {
        setBusy(false)
      }
    }
    onInsert(fillReplyVariables(r.body, { nombre: contactName, ref }))
  }

  async function save() {
    if (!form || !form.title.trim() || !form.body.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/inbox/canned-responses', {
        method: form.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(form.id ? { id: form.id } : {}), title: form.title, body: form.body, category: form.category }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'No se pudo guardar')
      setForm(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }

  async function remove(r: SavedReply) {
    if (!window.confirm(`¿Eliminar la respuesta «${r.title}»?`)) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/inbox/canned-responses', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id }) })
      if (!res.ok) throw new Error('No se pudo eliminar')
      setReplies((prev) => (prev || []).filter((x) => x.id !== r.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar')
    } finally {
      setBusy(false)
    }
  }

  const q = search.toLowerCase()
  const filtered = (replies || []).filter((r) => !q || r.title.toLowerCase().includes(q) || r.body.toLowerCase().includes(q))
  const byCategory = filtered.reduce<Record<string, SavedReply[]>>((acc, r) => {
    const cat = r.category || 'General'
    ;(acc[cat] ||= []).push(r)
    return acc
  }, {})

  return (
    <div className="mx-3 md:mx-5 mb-2 rounded-xl border bg-white shadow-lg max-h-72 overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <input
          autoFocus
          className="flex-1 min-w-0 text-base md:text-sm outline-none"
          placeholder="Buscar respuesta guardada…"
          aria-label="Buscar respuesta guardada"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {busy && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-gray-400" />}
        <button onClick={() => setForm({ id: null, title: '', body: '', category: '' })} className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-1 text-[11px] font-semibold text-primary-700 hover:bg-primary-100">
          <Plus className="h-3 w-3" /> Nueva
        </button>
        <button onClick={onClose} aria-label="Cerrar respuestas guardadas" className="shrink-0 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
      </div>
      {error && <p className="px-3 py-1.5 text-[11px] text-red-700 bg-red-50">{error}</p>}
      {form ? (
        <div className="overflow-y-auto p-3 space-y-2">
          <input className={input} placeholder="Título (ej.: Saludo)" value={form.title} maxLength={80} onChange={(e) => setForm({ ...form, title: e.target.value })} aria-label="Título" />
          <input className={input} placeholder="Categoría (opcional)" value={form.category} maxLength={40} onChange={(e) => setForm({ ...form, category: e.target.value })} aria-label="Categoría" />
          <textarea className={input} rows={3} placeholder="Hola {nombre}, sobre tu reserva {ref}…" value={form.body} maxLength={2000} onChange={(e) => setForm({ ...form, body: e.target.value })} aria-label="Texto" />
          <p className="text-[11px] text-gray-400">Variables: <code>{'{nombre}'}</code> (nombre del contacto) y <code>{'{ref}'}</code> (su última reserva).</p>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button onClick={() => setForm(null)} className="rounded-full border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button onClick={save} disabled={busy || !form.title.trim() || !form.body.trim()} className="rounded-full bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
              {form.id ? 'Guardar cambios' : 'Guardar respuesta'}
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-y-auto flex-1">
          {replies === null && <p className="px-3 py-4 text-sm text-gray-400 text-center">Cargando…</p>}
          {Object.entries(byCategory).map(([cat, list]) => (
            <div key={cat}>
              <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50">{cat}</p>
              {list.map((r) => (
                <div key={r.id} className="flex items-stretch hover:bg-primary-50 transition">
                  <button onClick={() => insert(r)} disabled={busy} className="flex-1 min-w-0 text-left px-3 py-2">
                    <p className="text-sm font-medium text-gray-800 truncate">{r.title}</p>
                    <p className="text-xs text-gray-500 truncate">{r.body}</p>
                  </button>
                  <button onClick={() => setForm({ id: r.id, title: r.title, body: r.body, category: r.category || '' })} aria-label={`Editar ${r.title}`} className="shrink-0 px-2 text-gray-400 hover:text-gray-700"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => remove(r)} aria-label={`Eliminar ${r.title}`} className="shrink-0 pr-3 pl-1 text-gray-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          ))}
          {replies !== null && filtered.length === 0 && (
            <p className="px-3 py-4 text-sm text-gray-400 text-center">{search ? 'Sin resultados' : 'Aún no hay respuestas guardadas'}</p>
          )}
        </div>
      )}
    </div>
  )
}

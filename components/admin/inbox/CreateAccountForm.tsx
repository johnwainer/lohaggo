'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Check, Copy, Loader2, UserPlus } from 'lucide-react'
import type { ContactDetail } from '@/components/admin/inbox/ContactPanel'

type Options = { cities: Array<{ slug: string; name: string; status: string }>; categories: Array<{ name: string; services: Array<{ id: string; name: string }> }>; maxServices: number }
type Result = { contact: ContactDetail; accessUrl: string; sent: boolean; sendError: string | null }

const input = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm'
const placeholder = (n: string | null) => !n || /^(Instagram|Messenger|WhatsApp|SMS) · /.test(n) || /^\+?\d[\d\s]+$/.test(n) || n.startsWith('CO.')

export function AccessLinkBox({ url, sent, sendError }: { url: string; sent: boolean; sendError: string | null }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2 text-xs text-emerald-900">
      <p>{sent ? 'Enlace de acceso enviado por este chat.' : sendError ? `No se pudo enviar por el chat (${sendError}). Cópialo y envíalo tú:` : 'Enlace de acceso (vale 72 horas):'}</p>
      <div className="flex gap-1.5">
        <input readOnly value={url} className="flex-1 min-w-0 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[11px]" onFocus={(e) => e.target.select()} />
        <button onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) }} className="rounded-lg border border-emerald-300 bg-white px-2 text-emerald-700">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <p className="text-[11px] text-emerald-800/80">La persona crea su propia contraseña al entrar. Nadie del equipo la conoce.</p>
    </div>
  )
}

export default function CreateAccountForm({ contact, conversationId, onCreated }: { contact: ContactDetail; conversationId: string; onCreated: (contact: ContactDetail) => void }) {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<'CLIENT' | 'PARTNER'>('CLIENT')
  const [form, setForm] = useState({ name: placeholder(contact.name) ? '' : contact.name || '', email: contact.email || '', phone: contact.phone || '', citySlug: '' })
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [sendLink, setSendLink] = useState(true)
  const [options, setOptions] = useState<Options | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    if (!open || options) return
    fetch(`/api/admin/inbox/contacts/${contact.id}/account`).then((r) => r.json()).then((d) => {
      setOptions(d)
      setForm((f) => ({ ...f, citySlug: f.citySlug || d.cities?.[0]?.slug || '' }))
    }).catch(() => null)
  }, [open, options, contact.id])

  async function create() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/inbox/contacts/${contact.id}/account`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, ...form, serviceIds, sendToConversationId: sendLink ? conversationId : undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo crear la cuenta')
      setResult(data)
      onCreated(data.contact)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  if (result) return <AccessLinkBox url={result.accessUrl} sent={result.sent} sendError={result.sendError} />

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-primary-300 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50">
        <UserPlus className="h-3.5 w-3.5" /> Crear cuenta en la plataforma
      </button>
    )
  }

  const maxServices = options?.maxServices ?? 5
  const toggleService = (id: string) => setServiceIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= maxServices ? prev : [...prev, id])
  const canSubmit = form.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(form.email) && (role === 'CLIENT' || (form.citySlug && serviceIds.length > 0))

  return (
    <div className="rounded-xl border border-primary-200 bg-primary-50/40 p-3 space-y-2.5">
      <div className="flex rounded-xl bg-white border border-gray-200 p-0.5 text-xs">
        {(['CLIENT', 'PARTNER'] as const).map((r) => (
          <button key={r} onClick={() => setRole(r)} className={`flex-1 rounded-lg py-1.5 font-medium ${role === r ? 'bg-primary-600 text-white' : 'text-gray-600'}`}>
            {r === 'CLIENT' ? 'Cliente' : 'Socio'}
          </button>
        ))}
      </div>
      <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre completo" />
      <input className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Correo (obligatorio)" inputMode="email" />
      <input className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Celular" inputMode="tel" />

      {role === 'PARTNER' && (
        <>
          <select className={input} value={form.citySlug} onChange={(e) => setForm({ ...form, citySlug: e.target.value })}>
            {options?.cities.map((c) => <option key={c.slug} value={c.slug}>{c.name}{c.status === 'COMING_SOON' ? ' (próximamente)' : ''}</option>)}
          </select>
          <div className="max-h-44 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 space-y-2">
            <p className="text-[11px] text-gray-500">Servicios ({serviceIds.length}/{maxServices}), a precio base: el socio los ajusta después.</p>
            {options?.categories.map((cat) => (
              <div key={cat.name}>
                <p className="text-[11px] font-medium text-gray-700">{cat.name}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {cat.services.map((s) => (
                    <button key={s.id} type="button" onClick={() => toggleService(s.id)} className={`rounded-full border px-2 py-0.5 text-[11px] ${serviceIds.includes(s.id) ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-gray-200 text-gray-600'}`}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-500">La cuenta nace sin verificar: el enlace lo lleva a subir sus documentos.</p>
        </>
      )}

      <label className="flex items-center gap-2 text-xs text-gray-700">
        <input type="checkbox" checked={sendLink} onChange={(e) => setSendLink(e.target.checked)} /> Enviar el enlace de acceso por este chat
      </label>
      {error && <p className="flex items-center gap-1.5 text-xs text-red-600"><AlertCircle className="h-3.5 w-3.5" /> {error}</p>}
      <div className="flex gap-2">
        <button onClick={create} disabled={!canSubmit || busy} className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />} Crear cuenta de {role === 'CLIENT' ? 'cliente' : 'socio'}
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-gray-500">Cancelar</button>
      </div>
    </div>
  )
}

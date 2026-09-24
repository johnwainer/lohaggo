'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2, Upload, XCircle } from 'lucide-react'
import { api, input } from '@/components/admin/marketing/shared'
import { LOGO_POSITIONS } from '@/lib/marketing/images-core'

type Kit = { logoUrl: string | null; logoPublicId: string | null; logoPosition: string; logoScale: number; logoOpacity: number; logoMargin: number; autoApply: boolean }
type Provider = { id: string; label: string; defaultModel: string; supportsReference: boolean; needsAccount: boolean; keyHint: string }
type Settings = { keys: Record<string, string | null>; provider: string; models: Record<string, string>; cloudflareAccountId: string | null; costPerImageUsd: number }

const DEFAULT_KIT: Kit = { logoUrl: null, logoPublicId: null, logoPosition: 'south_east', logoScale: 0.18, logoOpacity: 90, logoMargin: 24, autoApply: true }

/** Logo position preview drawn with CSS (the real image gets the same values from Cloudinary). */
function Preview({ kit }: { kit: Kit }) {
  const [v, h] = kit.logoPosition.split('_')
  const pos: React.CSSProperties = {
    width: `${kit.logoScale * 100}%`, opacity: kit.logoOpacity / 100,
    [v === 'north' ? 'top' : 'bottom']: `${(kit.logoMargin / 1080) * 100}%`,
    [h === 'west' ? 'left' : 'right']: `${(kit.logoMargin / 1080) * 100}%`,
  }
  return (
    <div className="relative aspect-[4/5] w-full max-w-[260px] overflow-hidden rounded-2xl bg-gradient-to-br from-sky-200 via-amber-100 to-emerald-200">
      <div className="absolute inset-x-6 bottom-10 top-16 rounded-xl bg-white/40" />
      {kit.logoUrl ? <img src={kit.logoUrl} alt="Logo" className="absolute h-auto" style={pos} /> : <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">Sin logo</span>}
    </div>
  )
}

export default function BrandTab({ workspaces }: { workspaces: Array<{ id: string; name: string; permissions: string[] }> }) {
  const [wsId, setWsId] = useState(workspaces[0]?.id || '')
  const [kit, setKit] = useState<Kit>(DEFAULT_KIT)
  const [canEditKit, setCanEditKit] = useState(false)
  const [img, setImg] = useState<{ canEdit: boolean; settings?: Settings; providers?: Provider[]; summary: { pexels: boolean; providerReady: boolean; providerReason: string | null; providerLabel: string } } | null>(null)
  const [draft, setDraft] = useState<{ keys: Record<string, string>; provider?: string; models: Record<string, string>; cloudflareAccountId?: string; costPerImageUsd?: string }>({ keys: {}, models: {} })
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!wsId) return
    const [k, s] = await Promise.all([
      api<{ kit: Kit | null; canEdit: boolean }>(`/api/admin/marketing/brand-kit?workspaceId=${wsId}`),
      api<{ canEdit: boolean; settings?: Settings; providers?: Provider[]; summary: { pexels: boolean; providerReady: boolean; providerReason: string | null; providerLabel: string } }>('/api/admin/marketing/image-settings'),
    ])
    setKit(k.kit ? { ...DEFAULT_KIT, ...k.kit } : DEFAULT_KIT)
    setCanEditKit(k.canEdit)
    setImg(s)
    setDraft({ keys: {}, models: {} })
  }, [wsId])
  useEffect(() => { load().catch((e) => setMsg({ ok: false, text: e.message })) }, [load])

  async function saveKit(patch: Partial<Kit> & { removeLogo?: boolean }) {
    setKit((k) => ({ ...k, ...patch }))
    try {
      const d = await api<{ kit: Kit }>('/api/admin/marketing/brand-kit', { method: 'PUT', json: { workspaceId: wsId, ...patch } })
      setKit({ ...DEFAULT_KIT, ...d.kit })
    } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : 'Error' }) }
  }

  async function uploadLogo(file: File | undefined) {
    if (!file) return
    setBusy('logo')
    try {
      const form = new FormData()
      form.append('workspaceId', wsId)
      form.append('file', file)
      const res = await fetch('/api/admin/marketing/brand-kit/logo', { method: 'POST', body: form })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'No se pudo subir')
      setKit({ ...DEFAULT_KIT, ...d.kit })
      setMsg({ ok: true, text: 'Logo guardado.' })
    } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : 'Error' }) } finally { setBusy(null) }
  }

  async function saveSettings() {
    setBusy('settings')
    try {
      await api('/api/admin/marketing/image-settings', {
        method: 'PUT',
        json: {
          keys: Object.fromEntries(Object.entries(draft.keys).filter(([, v]) => v.trim())),
          provider: draft.provider, models: draft.models,
          ...(draft.cloudflareAccountId !== undefined ? { cloudflareAccountId: draft.cloudflareAccountId } : {}),
          ...(draft.costPerImageUsd !== undefined ? { costPerImageUsd: Number(draft.costPerImageUsd) } : {}),
        },
      })
      setMsg({ ok: true, text: 'Fuentes de imágenes guardadas.' })
      await load()
    } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : 'Error' }) } finally { setBusy(null) }
  }

  async function testPexels() {
    setBusy('test')
    const d = await api<{ ok: boolean; total?: number; error?: string }>('/api/admin/marketing/image-settings', { method: 'PUT', json: { action: 'test_pexels', key: draft.keys.pexels } }).catch((e) => ({ ok: false, error: e.message }))
    setMsg(d.ok ? { ok: true, text: `Pexels responde (${(d as { total?: number }).total ?? 0} fotos para «home repair»).` } : { ok: false, text: (d as { error?: string }).error || 'Error' })
    setBusy(null)
  }

  const provider = draft.provider ?? img?.settings?.provider ?? 'none'
  const pInfo = img?.providers?.find((p) => p.id === provider)
  const ro = !canEditKit

  return (
    <div className="space-y-5">
      {msg && <div className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{msg.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />} {msg.text}</div>}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-gray-900">Kit de marca</h3>
            <p className="text-xs text-gray-500">El logo real se pone encima de las imágenes (no lo dibuja una IA): queda nítido y en el mismo sitio siempre. Se puede quitar de cada imagen.</p>
          </div>
          {workspaces.length > 1 && <select className="rounded-xl border border-gray-200 px-3 py-2 text-sm" value={wsId} onChange={(e) => setWsId(e.target.value)}>{workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>}
        </div>
        <div className="grid md:grid-cols-[260px_1fr] gap-6">
          <Preview kit={kit} />
          <fieldset disabled={ro} className="space-y-4">
            <div className="flex items-center gap-3">
              <input ref={fileRef} type="file" accept="image/png,image/webp,image/jpeg" className="hidden" onChange={(e) => { uploadLogo(e.target.files?.[0]); e.target.value = '' }} />
              <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50">
                {busy === 'logo' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {kit.logoUrl ? 'Cambiar logo' : 'Subir logo'}
              </button>
              {kit.logoUrl && <button onClick={() => saveKit({ removeLogo: true, logoUrl: null, logoPublicId: null })} className="text-xs text-red-600 hover:underline">Quitar</button>}
              <span className="text-xs text-gray-500">PNG con fondo transparente, máx. 3 MB.</span>
            </div>
            <label className="block space-y-1"><span className="text-xs font-medium text-gray-700">Posición</span>
              <select className={input} value={kit.logoPosition} onChange={(e) => saveKit({ logoPosition: e.target.value })}>{Object.entries(LOGO_POSITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
            <label className="block space-y-1"><span className="flex justify-between text-xs font-medium text-gray-700">Tamaño <span className="text-gray-500">{Math.round(kit.logoScale * 100)}% del ancho</span></span>
              <input type="range" min={5} max={40} value={Math.round(kit.logoScale * 100)} onChange={(e) => setKit((k) => ({ ...k, logoScale: Number(e.target.value) / 100 }))} onMouseUp={() => saveKit({ logoScale: kit.logoScale })} onTouchEnd={() => saveKit({ logoScale: kit.logoScale })} className="w-full" />
            </label>
            <label className="block space-y-1"><span className="flex justify-between text-xs font-medium text-gray-700">Opacidad <span className="text-gray-500">{kit.logoOpacity}%</span></span>
              <input type="range" min={20} max={100} value={kit.logoOpacity} onChange={(e) => setKit((k) => ({ ...k, logoOpacity: Number(e.target.value) }))} onMouseUp={() => saveKit({ logoOpacity: kit.logoOpacity })} onTouchEnd={() => saveKit({ logoOpacity: kit.logoOpacity })} className="w-full" />
            </label>
            <label className="block space-y-1"><span className="flex justify-between text-xs font-medium text-gray-700">Margen <span className="text-gray-500">{kit.logoMargin} px</span></span>
              <input type="range" min={0} max={120} value={kit.logoMargin} onChange={(e) => setKit((k) => ({ ...k, logoMargin: Number(e.target.value) }))} onMouseUp={() => saveKit({ logoMargin: kit.logoMargin })} onTouchEnd={() => saveKit({ logoMargin: kit.logoMargin })} className="w-full" />
            </label>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={kit.autoApply} onChange={(e) => saveKit({ autoApply: e.target.checked })} />
              <span>Poner el logo en todas las imágenes nuevas<span className="block text-xs text-gray-500">Subidas, de Pexels o generadas. En cada imagen se puede quitar o poner con «+logo / −logo». Los cambios de posición o tamaño aplican a las imágenes nuevas.</span></span>
            </label>
          </fieldset>
        </div>
        {ro && <p className="text-xs text-gray-500">Solo quien tiene permiso de publicar cambia el kit de marca.</p>}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-gray-900">Fuentes de imágenes</h3>
          <p className="text-xs text-gray-500">
            Pexels: fotos reales gratis con uso comercial. Generación con IA: opcional, se paga por imagen al proveedor que elijas.
            {img && ` Estado: Pexels ${img.summary.pexels ? 'activo' : 'sin clave'} · IA ${img.summary.providerReady ? img.summary.providerLabel : img.summary.providerReason}.`}
          </p>
        </div>
        {!img?.canEdit ? (
          <p className="text-sm text-gray-500">Solo el administrador de la plataforma configura las claves.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-[1fr_auto] gap-2 items-end">
              <label className="block space-y-1"><span className="text-xs font-medium text-gray-700">Clave de Pexels {img.settings?.keys.pexels ? <span className="text-gray-400">(guardada: {img.settings.keys.pexels})</span> : ''}</span>
                <input type="password" autoComplete="off" className={input} value={draft.keys.pexels || ''} onChange={(e) => setDraft((d) => ({ ...d, keys: { ...d.keys, pexels: e.target.value } }))} placeholder="pexels.com/api → Your API Key" />
              </label>
              <button onClick={testPexels} disabled={busy === 'test'} className="rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">{busy === 'test' ? <Loader2 size={14} className="animate-spin" /> : 'Probar'}</button>
            </div>
            <div className="space-y-2">
              <span className="text-xs font-medium text-gray-700">Generación con IA</span>
              <div className="grid sm:grid-cols-2 gap-2">
                {img.providers?.map((p) => (
                  <label key={p.id} className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${provider === p.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}>
                    <input type="radio" name="provider" className="mt-1" checked={provider === p.id} onChange={() => setDraft((d) => ({ ...d, provider: p.id }))} />
                    <span>{p.label}{p.id !== 'none' && <span className="block text-[11px] text-gray-500">{p.supportsReference ? 'Puede basarse en una imagen de referencia' : 'Solo desde texto'}</span>}</span>
                  </label>
                ))}
              </div>
            </div>
            {pInfo && pInfo.id !== 'none' && (
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block space-y-1"><span className="text-xs font-medium text-gray-700">Clave {img.settings?.keys[pInfo.id] ? <span className="text-gray-400">(guardada: {img.settings.keys[pInfo.id]})</span> : ''}</span>
                  <input type="password" autoComplete="off" className={input} value={draft.keys[pInfo.id] || ''} onChange={(e) => setDraft((d) => ({ ...d, keys: { ...d.keys, [pInfo.id]: e.target.value } }))} placeholder={pInfo.keyHint} />
                </label>
                <label className="block space-y-1"><span className="text-xs font-medium text-gray-700">Modelo</span>
                  <input className={input} value={draft.models[pInfo.id] ?? img.settings?.models[pInfo.id] ?? pInfo.defaultModel} onChange={(e) => setDraft((d) => ({ ...d, models: { ...d.models, [pInfo.id]: e.target.value } }))} />
                  <span className="block text-[11px] text-gray-500">Por defecto {pInfo.defaultModel}. Cámbialo si el proveedor publica uno nuevo.</span>
                </label>
                {pInfo.needsAccount && (
                  <label className="block space-y-1"><span className="text-xs font-medium text-gray-700">Account ID de Cloudflare</span>
                    <input className={input} value={draft.cloudflareAccountId ?? img.settings?.cloudflareAccountId ?? ''} onChange={(e) => setDraft((d) => ({ ...d, cloudflareAccountId: e.target.value }))} />
                  </label>
                )}
                <label className="block space-y-1"><span className="text-xs font-medium text-gray-700">Costo estimado por imagen (US$)</span>
                  <input type="number" step="0.001" min={0} className={input} value={draft.costPerImageUsd ?? String(img.settings?.costPerImageUsd ?? 0.04)} onChange={(e) => setDraft((d) => ({ ...d, costPerImageUsd: e.target.value }))} />
                  <span className="block text-[11px] text-gray-500">Se muestra antes de generar y se suma a los costos de IA del workspace (cuenta para su tope mensual).</span>
                </label>
              </div>
            )}
            <button onClick={saveSettings} disabled={busy === 'settings'} className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
              {busy === 'settings' && <Loader2 size={14} className="animate-spin" />} Guardar fuentes
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

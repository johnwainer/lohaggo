'use client'

import { useState } from 'react'
import { ImageIcon, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { api, input } from '@/components/admin/marketing/shared'
import { IMAGE_STYLES, allStyles, type ImageStyleConfig } from '@/lib/marketing/image-styles'

/**
 * «Estilo de las imágenes»: the looks the agent may use for its AI images, each with an example image,
 * whether the agent picks per piece or one style is fixed, and the team's own styles.
 */
export default function ImageStylesField({ agentId, value, onChange }: { agentId: string | null; value: ImageStyleConfig; onChange: (v: ImageStyleConfig) => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const styles = allStyles(value)
  const auto = value.pick === 'auto'

  const toggle = (id: string) => {
    const on = value.enabled.includes(id)
    const enabled = on ? value.enabled.filter((x) => x !== id) : [...value.enabled, id]
    if (!enabled.length) return
    onChange({ ...value, enabled })
  }

  const example = async (id: string) => {
    if (!agentId) return
    setBusy(id)
    setError(null)
    try {
      const r = await api<{ example: ImageStyleConfig['examples'][string]; aiError: string | null }>(`/api/admin/marketing/agents/${agentId}/image-style-example`, { method: 'POST', json: { styleId: id } })
      onChange({ ...value, examples: { ...value.examples, [id]: r.example } })
      if (r.aiError) setError(`La IA no está disponible (${r.aiError}); se puso una foto de referencia parecida.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el ejemplo')
    } finally {
      setBusy(null)
    }
  }

  const setCustom = (i: number, patch: Partial<{ label: string; prompt: string }>) => {
    const custom = value.custom.map((c, n) => (n === i ? { ...c, ...patch } : c))
    onChange({ ...value, custom })
  }
  const addCustom = () => {
    const used = new Set(value.custom.map((c) => c.id))
    let n = value.custom.length + 1
    while (used.has(`custom-${n}`)) n++
    const id = `custom-${n}`
    onChange({ ...value, custom: [...value.custom, { id, label: '', prompt: '' }], enabled: [...value.enabled, id] })
  }
  const removeCustom = (id: string) => {
    const { [id]: _drop, ...examples } = value.examples
    onChange({ ...value, custom: value.custom.filter((c) => c.id !== id), enabled: value.enabled.filter((x) => x !== id), examples, pick: value.pick === id ? 'auto' : value.pick })
  }

  return (
    <section className="space-y-3 rounded-2xl border border-gray-200 p-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Estilo de las imágenes</h3>
        <p className="text-xs text-gray-600">Cómo se ven las imágenes que genera la IA. Con «el agente elige», usa en cada pieza el estilo que mejor le sirva entre los que marques.</p>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-gray-700">Cómo se elige el estilo</span>
        <select className={input} value={value.pick} onChange={(e) => onChange({ ...value, pick: e.target.value })}>
          <option value="auto">El agente elige el estilo de cada pieza (recomendado)</option>
          {styles.filter((s) => s.label).map((s) => <option key={s.id} value={s.id}>Siempre «{s.label}»</option>)}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {styles.map((s) => {
          const ex = value.examples[s.id]
          const on = auto ? value.enabled.includes(s.id) : value.pick === s.id
          const meta = IMAGE_STYLES.find((x) => x.id === s.id)
          return (
            <div key={s.id} className={`flex flex-col overflow-hidden rounded-2xl border-2 bg-white ${on ? 'border-primary-500' : 'border-gray-200'}`}>
              <div className="relative aspect-square w-full bg-gradient-to-br from-gray-100 to-gray-200">
                {ex
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={ex.url.replace('/image/upload/', '/image/upload/c_fill,w_400,h_400,f_auto/')} alt={`Ejemplo del estilo ${s.label}`} className="h-full w-full object-cover" loading="lazy" />
                  : <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center text-gray-500"><ImageIcon size={22} aria-hidden="true" /><span className="text-[11px]">{meta && meta.exampleQuery === null ? 'Se muestra con la IA: el agente lo genera solo cuando esté disponible' : 'Sin ejemplo todavía'}</span></div>}
                {ex && <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">{ex.source === 'ai' ? 'Con tu IA' : 'Referencia'}</span>}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="text-sm font-semibold text-gray-900">{s.label || 'Estilo propio'}</p>
                {meta && <p className="text-xs text-gray-600">{meta.description}</p>}
                {meta && <p className="text-[11px] text-gray-500"><span className="font-semibold">Sirve para:</span> {meta.whenToUse}</p>}
                <div className="mt-auto flex flex-col gap-1.5 pt-2">
                  {auto && (
                    <label className="flex min-h-[36px] items-center gap-2 text-xs text-gray-700">
                      <input type="checkbox" checked={value.enabled.includes(s.id)} onChange={() => toggle(s.id)} />
                      El agente lo puede usar
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => example(s.id)}
                    disabled={!agentId || busy !== null || !s.prompt}
                    title={!agentId ? 'Guarda el agente primero' : undefined}
                    className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-full border border-gray-300 px-3 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {busy === s.id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
                    {ex ? 'Otro ejemplo' : 'Ver ejemplo'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {!agentId && <p className="text-xs text-gray-600">Guarda el agente para generar los ejemplos.</p>}
      {error && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900" role="status">{error}</p>}
      <p className="text-[11px] text-gray-500">Cada ejemplo con IA cuesta una imagen. Si la IA no está disponible, se muestra una foto de referencia parecida.</p>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-700">Estilos propios</p>
        {value.custom.map((c, i) => (
          <div key={c.id} className="grid gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-[180px_1fr_auto]">
            <input className={input} placeholder="Nombre (ej. Acuarela)" value={c.label} maxLength={40} onChange={(e) => setCustom(i, { label: e.target.value })} aria-label="Nombre del estilo propio" />
            <input className={input} placeholder="Cómo se ve (ej. ilustración en acuarela, trazos suaves, tonos pastel)" value={c.prompt} maxLength={400} onChange={(e) => setCustom(i, { prompt: e.target.value })} aria-label="Descripción del estilo para la IA" />
            <button type="button" onClick={() => removeCustom(c.id)} aria-label={`Quitar el estilo ${c.label || 'propio'}`} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-600 hover:bg-gray-200"><Trash2 size={16} aria-hidden="true" /></button>
          </div>
        ))}
        {value.custom.length < 4 && (
          <button type="button" onClick={addCustom} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-primary-700 hover:bg-primary-50">
            <Plus size={14} aria-hidden="true" /> Agregar un estilo propio
          </button>
        )}
      </div>
    </section>
  )
}

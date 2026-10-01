'use client'

import { input } from '@/components/admin/marketing/shared'
import type { PublishOptions } from '@/lib/marketing/publish-options'

const IG_CHOICES = [
  { value: '', label: 'Automático según los archivos' },
  { value: 'feed', label: 'Foto (una imagen)' },
  { value: 'carousel', label: 'Carrusel (2 a 10 archivos)' },
  { value: 'reel', label: 'Reel (video)' },
  { value: 'trial_reel', label: 'Reel de prueba (solo quienes no te siguen)' },
  { value: 'story', label: 'Historia (24 h, sin texto)' },
]
const FB_CHOICES = [
  { value: '', label: 'Publicación (texto, enlace, fotos o video)' },
  { value: 'reel', label: 'Reel (video vertical de 3 a 90 s)' },
  { value: 'story', label: 'Historia (24 h, sin texto)' },
]

/** Format of a Facebook / Instagram variant and its options (reel cover, collaborators, location, trial, story text). */
export default function FormatOptions({ channel, format, options, editable, onChange }: {
  channel: 'FACEBOOK' | 'INSTAGRAM'
  format: string | null
  options: PublishOptions | null
  editable: boolean
  onChange: (patch: { format?: string | null; publishOptions?: PublishOptions | null }) => void
}) {
  const o = options || {}
  const set = (patch: Partial<PublishOptions>) => {
    const next: Record<string, unknown> = { ...o, ...patch }
    for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === '' || (Array.isArray(next[k]) && !(next[k] as unknown[]).length)) delete next[k]
    onChange({ publishOptions: Object.keys(next).length ? (next as PublishOptions) : null })
  }
  const story = format === 'story'
  const reel = format === 'reel' || format === 'trial_reel'
  const ig = channel === 'INSTAGRAM'
  const choices = ig ? IG_CHOICES : FB_CHOICES
  return (
    <div className="space-y-2">
      <label className="block space-y-1">
        <span className="text-xs font-medium text-gray-700">Formato</span>
        <select className={input} disabled={!editable} value={format || ''} onChange={(e) => onChange({ format: e.target.value || null })}>
          {choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </label>

      {(story || reel) && (
        <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2 text-xs">
          <p className="font-medium text-gray-700">Texto en pantalla</p>
          <label className="block space-y-1">
            <span className="text-gray-700">Titular (máx. 60 caracteres)</span>
            <input className={input} maxLength={90} disabled={!editable} value={o.storyText || ''} onChange={(e) => set({ storyText: e.target.value || undefined })} placeholder="¿Humedad en las paredes?" />
          </label>
          <label className="block space-y-1">
            <span className="text-gray-700">Llamada a la acción (máx. 25)</span>
            <input className={input} maxLength={40} disabled={!editable} value={o.storyCta || ''} onChange={(e) => set({ storyCta: e.target.value || undefined })} placeholder="Escríbenos por DM" />
          </label>
          <label className="flex items-center gap-2"><input type="checkbox" disabled={!editable} checked={o.renderText === true} onChange={(e) => set({ renderText: e.target.checked ? true : undefined })} /> Escribirlo sobre la imagen o el video</label>
          <span className="block text-[11px] text-gray-500">{story ? 'Las historias no muestran el texto de arriba ni enlaces: el mensaje va en pantalla. ' : ''}Si lo desmarcas, la imagen o el video ya deben traer el texto. Pasa por la revisión editorial.</span>
        </div>
      )}

      {(reel || (ig && !story)) && (
        <details className="rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2 text-xs">
          <summary className="cursor-pointer font-medium text-gray-700">Opciones {reel ? 'del reel' : 'de la publicación'}</summary>
          <div className="mt-2 space-y-2">
            {reel && (
              <>
                <label className="block space-y-1">
                  <span className="text-gray-700">Portada (enlace https de una imagen)</span>
                  <input className={input} disabled={!editable} value={o.coverUrl || ''} onChange={(e) => set({ coverUrl: e.target.value.trim() || undefined })} placeholder="https://res.cloudinary.com/…" />
                </label>
                {ig && !o.coverUrl && (
                  <label className="block space-y-1">
                    <span className="text-gray-700">O el cuadro del video en el segundo</span>
                    <input type="number" min={0} step={0.5} className={input} disabled={!editable} value={o.thumbOffsetMs != null ? o.thumbOffsetMs / 1000 : ''} onChange={(e) => set({ thumbOffsetMs: e.target.value === '' ? undefined : Math.round(Number(e.target.value) * 1000) })} />
                  </label>
                )}
              </>
            )}
            {ig && (
              <label className="block space-y-1">
                <span className="text-gray-700">Colaboradores (hasta 3 usuarios, separados por coma)</span>
                <input className={input} disabled={!editable} value={(o.collaborators || []).join(', ')} onChange={(e) => set({ collaborators: e.target.value.split(',').map((x) => x.trim().replace(/^@/, '')).filter(Boolean) })} placeholder="usuario1, usuario2" />
                <span className="block text-[11px] text-gray-500">Les llega una invitación; si aceptan, la publicación aparece también en su perfil.</span>
              </label>
            )}
            <label className="block space-y-1">
              <span className="text-gray-700">Ubicación (id del lugar en Facebook)</span>
              <input className={input} inputMode="numeric" disabled={!editable} value={o.locationId || ''} onChange={(e) => set({ locationId: e.target.value.replace(/\D/g, '') || undefined })} placeholder="Opcional" />
            </label>
            {format === 'reel' && ig && (
              <label className="flex items-center gap-2"><input type="checkbox" disabled={!editable} checked={o.shareToFeed !== false} onChange={(e) => set({ shareToFeed: e.target.checked ? undefined : false })} /> Mostrarlo también en la cuadrícula del perfil</label>
            )}
            {format === 'trial_reel' && (
              <label className="block space-y-1">
                <span className="text-gray-700">Si funciona bien</span>
                <select className={input} disabled={!editable} value={o.trialGraduation || 'MANUAL'} onChange={(e) => set({ trialGraduation: e.target.value === 'SS_PERFORMANCE' ? 'SS_PERFORMANCE' : undefined })}>
                  <option value="MANUAL">Lo comparto con los seguidores a mano desde la app</option>
                  <option value="SS_PERFORMANCE">Instagram lo comparte con los seguidores automáticamente</option>
                </select>
              </label>
            )}
            {ig && (
              <label className="flex items-center gap-2"><input type="checkbox" disabled={!editable} checked={o.aiLabel === true} onChange={(e) => set({ aiLabel: e.target.checked ? true : undefined })} /> Etiqueta «Hecho con IA» (las imágenes generadas con IA la llevan siempre)</label>
            )}
          </div>
        </details>
      )}
    </div>
  )
}

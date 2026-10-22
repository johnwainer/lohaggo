'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useDialog } from '@/components/ui/use-dialog'

export type InboxTool = 'cleanup' | 'backfill'

type CleanupResult = { total: number; counts: { inactiveOutbound: number; smsOutboundOnly: number; staleAwaiting: number }; byChannel: Record<string, number>; closed: number }
type BackfillResult = { counts: { open: number; awaitingReply: number; waitingOnContact: number; automatedOnly: number; lastMessageAtBumped: number }; updated: number }

const CHANNEL_NAMES: Record<string, string> = {
  WHATSAPP: 'WhatsApp', SMS: 'SMS', INSTAGRAM: 'Instagram', MESSENGER: 'Messenger', FACEBOOK_COMMENT: 'Comentarios de Facebook', INSTAGRAM_COMMENT: 'Comentarios de Instagram',
}

const n = (x: number) => x.toLocaleString('es-CO')

/**
 * Superadmin tools of the inbox. Always previews first (dryRun) and shows what would change;
 * only the confirm button applies it.
 */
export default function InboxToolsDialog({ tool, onClose, onDone }: { tool: InboxTool | null; onClose: () => void; onDone: () => void }) {
  const open = tool !== null
  const { dialogProps, titleId } = useDialog(open, onClose)
  const [preview, setPreview] = useState<CleanupResult | BackfillResult | null>(null)
  const [done, setDone] = useState<CleanupResult | BackfillResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fixLastMessageAt, setFixLastMessageAt] = useState(true)

  const url = tool === 'cleanup' ? '/api/admin/inbox/cleanup' : '/api/admin/inbox/backfill'

  useEffect(() => {
    if (!tool) return
    setPreview(null); setDone(null); setError(null); setBusy(true)
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dryRun: true }) })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error || `No se pudo calcular (HTTP ${r.status})`)
        setPreview(d)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo calcular'))
      .finally(() => setBusy(false))
  }, [tool, url])

  async function apply() {
    setBusy(true); setError(null)
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dryRun: false, ...(tool === 'backfill' ? { fixLastMessageAt } : {}) }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || `No se pudo aplicar (HTTP ${r.status})`)
      setDone(d)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo aplicar')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null
  const cleanup = tool === 'cleanup' ? (preview as CleanupResult | null) : null
  const backfill = tool === 'backfill' ? (preview as BackfillResult | null) : null
  const nothing = cleanup ? cleanup.total === 0 : false

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div {...dialogProps} className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-xl focus:outline-none">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-bold text-gray-900">
            {tool === 'cleanup' ? 'Cerrar conversaciones inactivas' : 'Recalcular «Por responder»'}
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>

        {tool === 'cleanup' && (
          <p className="mt-2 text-sm text-gray-600">
            Se cierran las abiertas sin actividad hace más de 7 días cuyo último mensaje es nuestro o automático, los SMS a los que nadie respondió
            y los clientes cuyo último mensaje tiene más de 30 días. Quien escribió hace menos de 30 días sigue en «Por responder».
            Si alguien vuelve a escribir, su conversación se reabre.
          </p>
        )}
        {tool === 'backfill' && (
          <p className="mt-2 text-sm text-gray-600">
            Revisa el último mensaje real (sin notas internas ni plantillas automáticas) de cada conversación abierta y marca cuáles esperan respuesta.
          </p>
        )}

        <div className="mt-4 rounded-2xl border bg-gray-50 p-3 text-sm" aria-live="polite">
          {busy && !preview && <p className="text-gray-500">Calculando…</p>}
          {cleanup && !done && (
            <>
              <p className="font-semibold text-gray-900">{nothing ? 'No hay nada que cerrar.' : `Se cerrarían ${n(cleanup.total)} conversaciones:`}</p>
              {!nothing && (
                <ul className="mt-2 space-y-1 text-gray-700">
                  <li>{n(cleanup.counts.inactiveOutbound)} sin actividad hace más de 7 días (último mensaje nuestro o automático)</li>
                  <li>{n(cleanup.counts.smsOutboundOnly)} SMS solo de avisos, sin respuesta</li>
                  <li>{n(cleanup.counts.staleAwaiting)} con el último mensaje del cliente hace más de 30 días</li>
                </ul>
              )}
              {!nothing && (
                <p className="mt-2 text-xs text-gray-500">
                  Por canal: {Object.entries(cleanup.byChannel).map(([ch, c]) => `${CHANNEL_NAMES[ch] ?? ch} ${n(c)}`).join(' · ')}
                </p>
              )}
            </>
          )}
          {backfill && !done && (
            <>
              <p className="font-semibold text-gray-900">{n(backfill.counts.open)} conversaciones abiertas</p>
              <ul className="mt-2 space-y-1 text-gray-700">
                <li>{n(backfill.counts.awaitingReply)} esperan respuesta</li>
                <li>{n(backfill.counts.waitingOnContact)} esperan al cliente</li>
                <li>{n(backfill.counts.automatedOnly)} solo tienen avisos automáticos</li>
              </ul>
              {backfill.counts.lastMessageAtBumped > 0 && (
                <label className="mt-3 flex items-start gap-2 text-xs text-gray-600">
                  <input type="checkbox" className="mt-0.5" checked={fixLastMessageAt} onChange={(e) => setFixLastMessageAt(e.target.checked)} />
                  <span>Ordenar {n(backfill.counts.lastMessageAtBumped)} conversaciones por su último mensaje real (una plantilla automática las había subido)</span>
                </label>
              )}
            </>
          )}
          {done && tool === 'cleanup' && <p className="font-semibold text-emerald-700">Listo: {n((done as CleanupResult).closed)} conversaciones cerradas.</p>}
          {done && tool === 'backfill' && <p className="font-semibold text-emerald-700">Listo: {n((done as BackfillResult).updated)} conversaciones actualizadas.</p>}
          {error && <p role="alert" className="text-rose-700">{error}</p>}
        </div>

        <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button onClick={onClose} className="rounded-full border px-4 py-2.5 sm:py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {done ? 'Cerrar' : 'Cancelar'}
          </button>
          {!done && preview && !nothing && (
            <button
              onClick={apply}
              disabled={busy}
              className={`rounded-full px-4 py-2.5 sm:py-2 text-sm font-semibold text-white disabled:opacity-50 ${tool === 'cleanup' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-primary-600 hover:bg-primary-700'}`}
            >
              {busy ? 'Aplicando…' : tool === 'cleanup' ? `Cerrar ${n(cleanup?.total ?? 0)}` : 'Recalcular'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { PANEL_REASONS, PROPOSAL_REASON_LABEL, type ProposalReason } from '@/lib/proposals/feedback'

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'

/**
 * «No me sirve»: turns one proposal down with an optional reason (chips + a line of text) that the team
 * sees. POST /api/proposals/{id}/reject. The request stays open for other proposals.
 */
export default function RejectProposalSheet({ proposalId, partnerName, onClose, onDone }: { proposalId: string; partnerName: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState<ProposalReason | null>(null)
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/proposals/${proposalId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reason ? { reason, detail: detail.trim() || null } : {}),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(data.error || 'No se pudo rechazar la propuesta')
    onDone()
  }

  return (
    <BottomSheet
      open
      onClose={busy ? () => null : onClose}
      dismissible={!busy}
      title="¿No te sirve esta propuesta?"
      description={`${partnerName} recibirá el aviso. Tu solicitud sigue abierta para otras propuestas.`}
    >
      <div>
        <p id="reject-proposal-why" className="mb-2 text-sm font-medium text-gray-800">¿Por qué no te sirve? <span className="font-normal text-gray-500">(opcional)</span></p>
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-labelledby="reject-proposal-why">
          {PANEL_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={reason === r}
              onClick={() => setReason(reason === r ? null : r)}
              className={`min-h-[44px] rounded-full border px-4 py-2 text-sm ${focusRing} ${reason === r ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-gray-300 text-gray-700'}`}
            >
              {PROPOSAL_REASON_LABEL[r]}
            </button>
          ))}
        </div>
        <label htmlFor="reject-proposal-detail" className="mb-1 block text-sm font-medium text-gray-700">Cuéntanos más <span className="font-normal text-gray-500">(opcional)</span></label>
        <textarea id="reject-proposal-detail" rows={2} maxLength={300} value={detail} onChange={(e) => setDetail(e.target.value)} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-base focus:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" placeholder="Ej.: el precio es alto" />
        {error && <p className="mt-2 text-sm text-rose-700" role="alert">{error}</p>}
        <button type="button" onClick={submit} disabled={busy} className={`mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3.5 font-semibold text-white disabled:opacity-50 ${focusRing}`}>
          {busy && <Loader2 size={18} className="animate-spin" aria-hidden="true" />} No me sirve
        </button>
      </div>
    </BottomSheet>
  )
}

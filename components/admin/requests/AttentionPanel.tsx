'use client'

import Link from 'next/link'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import { INTERVENTION_LABEL } from '@/lib/admin/attention-core'
import type { AttentionFlag, Intervention } from './types'
import { SEVERITY, btn } from './ui'

export function AttentionPanel({ flags, onIntervene, busy, hasBooking }: { flags: AttentionFlag[]; onIntervene: (i: Intervention) => void; busy: boolean; hasBooking: boolean }) {
  if (!flags.length) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
        <CheckCircle2 className="h-5 w-5 flex-shrink-0" /> Nada requiere atención en esta solicitud.
      </div>
    )
  }
  const needsBooking: Intervention[] = ['reschedule', 'cancel_booking', 'reopen_to_others']
  return (
    <div className="space-y-2">
      {flags.map((f) => {
        const s = SEVERITY[f.severity]
        return (
          <div key={f.code} className={`rounded-2xl border p-3 sm:p-4 ${s.box}`}>
            <div className="flex items-start gap-2">
              <s.Icon className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{f.title}</p>
                {f.detail && <p className="mt-0.5 text-sm opacity-90">{f.detail}</p>}
                {f.suggest.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {f.suggest.map((i) =>
                      i === 'review_guarantee' ? (
                        <Link key={i} href="/admin/guarantee" className={`${btn.small} border-current bg-white/70 hover:bg-white`}>
                          {INTERVENTION_LABEL[i]} <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <button key={i} type="button" disabled={busy || (needsBooking.includes(i) && !hasBooking)} onClick={() => onIntervene(i)} className={`${btn.small} border-current bg-white/70 hover:bg-white`}>
                          {INTERVENTION_LABEL[i]}
                        </button>
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

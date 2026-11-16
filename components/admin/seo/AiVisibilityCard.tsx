'use client'

import { Bot } from 'lucide-react'
import type { AiVisibilityData } from '@/lib/seo/agent/ai-visibility-core'
import { card, fmtWhen } from './shared'

type Row = AiVisibilityData['results'][number]

function status(r: Row) {
  if (r.error) return { label: 'Sin medir', cls: 'bg-gray-100 text-gray-600' }
  if (r.cited || r.mentioned) return { label: 'Aparece', cls: 'bg-emerald-100 text-emerald-800' }
  return { label: 'No aparece', cls: 'bg-rose-100 text-rose-700' }
}

export function AiVisibilityCard({ data }: { data: AiVisibilityData | null | undefined }) {
  const missing = data ? data.results.some((r) => !r.error && !r.cited && !r.mentioned) : false
  return (
    <section className={card}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700"><Bot className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-gray-900">Visibilidad en respuestas de IA</h3>
          <p className="mt-0.5 text-sm text-gray-600">Si las IA con búsqueda web nos recomiendan o citan cuando alguien pregunta por un servicio en Medellín.</p>
        </div>
      </div>

      {!data || data.results.length === 0 ? (
        <p className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">Todavía no se ha medido: se mide una vez por semana.</p>
      ) : (
        <>
          <p className="mt-4 text-lg font-semibold text-gray-900">
            Nos citaron en {data.summary.cited} de {data.summary.asked} preguntas
            <span className="block text-sm font-normal text-gray-600">Nos nombraron en {data.summary.mentioned}. Última medición: {fmtWhen(data.checkedAt)}</span>
          </p>

          <ul className="mt-3 space-y-2">
            {data.results.map((r) => {
              const s = status(r)
              return (
                <li key={r.query} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>
                    {r.position != null && <span className="text-xs text-gray-600">posición {r.position} entre las fuentes</span>}
                  </div>
                  <p className="mt-1.5 break-words text-sm font-medium text-gray-900">{r.query}</p>
                  {r.error ? (
                    <p className="mt-1 break-words text-xs text-gray-500">{r.error}</p>
                  ) : !r.cited && r.competitors.length > 0 ? (
                    <p className="mt-1 break-words text-xs text-gray-600">En su lugar aparece: {r.competitors.slice(0, 4).map((c) => c.host).join(', ')}</p>
                  ) : null}
                </li>
              )
            })}
          </ul>

          {data.summary.topCompetitors.length > 0 && (
            <p className="mt-3 break-words text-sm text-gray-700">
              <span className="font-medium">Quién aparece más:</span> {data.summary.topCompetitors.slice(0, 5).map((c) => `${c.host} (${c.count})`).join(', ')}
            </p>
          )}

          {missing && (
            <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">Qué hacer</p>
              <p className="mt-0.5">Poner una respuesta corta al inicio de cada página de servicio, completar los datos estructurados, juntar reseñas y publicar artículos que respondan justo esas preguntas.</p>
            </div>
          )}
        </>
      )}
    </section>
  )
}

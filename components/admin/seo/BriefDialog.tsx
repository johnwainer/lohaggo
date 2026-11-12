'use client'

import { X } from 'lucide-react'
import { useDialog } from '@/components/ui/use-dialog'
import type { SeoBrief } from '@/lib/seo/agent/types'

const INTENT: Record<string, string> = { informacional: 'Informativa', transaccional: 'Quiere contratar', comparativa: 'Comparar opciones', local: 'Busca algo cerca' }

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>{children}</div>
}

export default function BriefDialog({ title, brief, onClose }: { title: string; brief: SeoBrief; onClose: () => void }) {
  const { dialogProps, titleId } = useDialog(true, onClose)
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div {...dialogProps} className="relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-xl focus:outline-none sm:max-w-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b px-5 pb-3 pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="break-words text-base font-bold text-gray-900">Brief del artículo</h2>
            <p className="mt-0.5 break-words text-xs text-gray-500">{title}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 sm:h-9 sm:w-9"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm text-gray-800">
          <Block title="Título del artículo"><p className="break-words font-semibold">{brief.title}</p></Block>
          <div className="grid gap-4 sm:grid-cols-2">
            <Block title="Palabra clave"><p className="break-words">{brief.keyword}</p>{brief.secondary?.length > 0 && <p className="mt-1 break-words text-xs text-gray-500">Relacionadas: {brief.secondary.join(', ')}</p>}</Block>
            <Block title="Qué busca quien llega"><p>{INTENT[brief.intent] ?? brief.intent}</p></Block>
          </div>
          <Block title="Título para Google"><p className="break-words">{brief.seoTitle}</p></Block>
          <Block title="Descripción para Google"><p className="break-words">{brief.seoDescription}</p></Block>
          <Block title="Estructura">
            <ol className="list-decimal space-y-2 pl-5">
              {brief.outline.map((s, i) => (
                <li key={i} className="break-words"><span className="font-medium">{s.h2}</span>
                  {s.points?.length > 0 && <ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-xs text-gray-600">{s.points.map((p, j) => <li key={j}>{p}</li>)}</ul>}
                </li>
              ))}
            </ol>
          </Block>
          {brief.faqs?.length > 0 && (
            <Block title="Preguntas frecuentes">
              <dl className="space-y-2">{brief.faqs.map((f, i) => <div key={i}><dt className="break-words font-medium">{f.q}</dt><dd className="break-words text-xs text-gray-600">{f.a}</dd></div>)}</dl>
            </Block>
          )}
          {brief.internalLinks?.length > 0 && (
            <Block title="Enlaces internos">
              <ul className="space-y-1">{brief.internalLinks.map((l, i) => <li key={i} className="break-all text-xs"><a href={l.url} target="_blank" rel="noreferrer" className="text-primary-700 hover:underline">{l.url}</a> <span className="text-gray-500">con el texto «{l.anchor}»</span></li>)}</ul>
            </Block>
          )}
          {brief.facts?.length > 0 && <Block title="Datos que se pueden usar"><ul className="list-disc space-y-0.5 pl-5">{brief.facts.map((f, i) => <li key={i} className="break-words">{f}</li>)}</ul></Block>}
          <Block title="Llamado a la acción"><p className="break-words">{brief.cta}</p></Block>
          <p className="text-xs text-gray-500">Formato: {brief.format} · Marcado: {brief.schema}</p>
          {brief.notes && <Block title="Notas"><p className="whitespace-pre-line break-words">{brief.notes}</p></Block>}
        </div>
        <div className="border-t px-5 py-3">
          <button onClick={onClose} className="min-h-[44px] w-full rounded-full border px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:ml-auto sm:block sm:min-h-[40px] sm:w-auto">Cerrar</button>
        </div>
      </div>
    </div>
  )
}

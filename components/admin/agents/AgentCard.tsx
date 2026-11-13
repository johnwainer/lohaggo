import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { TOPIC_LABEL, STATUS_LIVE, type AgentCardData } from './shared'
import { card } from '../seo/shared'

function Block({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <ul className="mt-1 space-y-0.5 text-sm text-gray-700">
        {items.map((t) => <li key={t} className="break-words">· {t}</li>)}
      </ul>
    </div>
  )
}

export default function AgentCard({ agent }: { agent: AgentCardData }) {
  const st = STATUS_LIVE[agent.live.status] ?? STATUS_LIVE.unknown
  const accepts = Object.entries(agent.accepts).map(([t, w]) => `${TOPIC_LABEL[t] ?? t}: ${w}`)
  return (
    <article className={`${card} flex min-w-0 flex-col gap-3`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 break-words text-base font-bold text-gray-900">{agent.name}</h3>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>
          <span className={`h-2 w-2 rounded-full ${st.dot}`} /> {st.label}
        </span>
      </div>
      <div className="rounded-xl bg-gray-50 p-3">
        <p className="break-words text-sm font-semibold text-gray-900">{agent.live.headline}</p>
        {agent.live.details.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
            {agent.live.details.map((d, i) => <li key={i} className="break-words">· {d}</li>)}
          </ul>
        )}
      </div>
      <p className="break-words text-sm text-gray-700">{agent.purpose}</p>
      <Block title="Qué lee" items={agent.reads} />
      <Block title="Qué produce" items={agent.produces} />
      <Block title="Notas que recibe" items={accepts} />
      <p className="break-words text-sm text-gray-700"><span className="font-semibold">Autonomía:</span> {agent.autonomy}</p>
      <Link href={agent.adminUrl} className="mt-auto inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:min-h-[40px]">
        Abrir su pantalla <ArrowRight size={14} />
      </Link>
    </article>
  )
}

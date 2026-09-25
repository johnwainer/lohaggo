'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { api, fmtDateTime } from '@/components/admin/marketing/shared'

type Notice = { id: string; type: string; title: string; body: string | null; url: string | null; readAt: string | null; createdAt: string; agentId: string }

const DOT: Record<string, string> = { approval_needed: 'bg-amber-500', opt_out_window: 'bg-violet-500', failed: 'bg-red-500', budget: 'bg-orange-500', degraded: 'bg-orange-500', published: 'bg-emerald-500', learning: 'bg-sky-500', ideas: 'bg-primary-500' }

/** The marketing agents' notices: unread count on the bell, list on click (opening marks them read). */
export default function NoticesBell({ workspaceId, onOpenAgent }: { workspaceId: string; onOpenAgent: (agentId: string) => void }) {
  const [data, setData] = useState<{ notices: Notice[]; unread: number } | null>(null)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    api<{ notices: Notice[]; unread: number }>(`/api/admin/marketing/agents/notices${workspaceId ? `?workspaceId=${workspaceId}` : ''}`).then(setData).catch(() => null)
  }, [workspaceId])
  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  async function toggle() {
    setOpen((o) => !o)
    if (!open && data?.unread) {
      const ids = data.notices.filter((n) => !n.readAt).map((n) => n.id)
      await api('/api/admin/marketing/agents/notices', { method: 'PATCH', json: { ids } }).catch(() => null)
      setData((d) => (d ? { ...d, unread: Math.max(0, d.unread - ids.length) } : d))
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative rounded-full border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50" aria-label="Avisos de los agentes">
        <Bell size={18} />
        {Boolean(data?.unread) && <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-[18px] text-white">{data!.unread > 99 ? '99+' : data!.unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
          <p className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-900">Avisos del agente de marketing</p>
          <div className="max-h-[60vh] overflow-y-auto">
            {!data?.notices.length && <p className="px-4 py-6 text-center text-sm text-gray-500">Sin avisos.</p>}
            {data?.notices.map((n) => {
              const content = (
                <div className={`flex gap-3 px-4 py-3 hover:bg-gray-50 ${n.readAt ? '' : 'bg-primary-50/40'}`}>
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[n.type] ?? 'bg-gray-400'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{n.title}</p>
                    {n.body && <p className="line-clamp-2 text-xs text-gray-600 whitespace-pre-line">{n.body}</p>}
                    <p className="mt-0.5 text-[11px] text-gray-400">{fmtDateTime(n.createdAt)}</p>
                  </div>
                </div>
              )
              if (n.url?.startsWith('/admin/marketing/posts/')) return <Link key={n.id} href={n.url} onClick={() => setOpen(false)} className="block border-b border-gray-50">{content}</Link>
              return <button key={n.id} onClick={() => { setOpen(false); onOpenAgent(n.agentId) }} className="block w-full border-b border-gray-50 text-left">{content}</button>
            })}
          </div>
        </div>
      )}
    </div>
  )
}

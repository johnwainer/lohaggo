'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { floatingWaContext, waHref } from '@/lib/public/whatsapp'
import { track } from '@/lib/analytics/track'
import { WhatsAppIcon } from '@/components/WhatsAppButton'

interface FloatingConfig {
  whatsapp_float_button?: { enabled: boolean; config: { phone?: string; message?: string } }
}

/** Pages with their own fixed bottom CTA on mobile: the button sits above it. */
const RAISED_PREFIXES = ['/pro/']

export default function FloatingButtons() {
  const [cfg, setCfg] = useState<FloatingConfig | null>(null)
  const pathname = usePathname() || '/'

  useEffect(() => {
    fetch('/api/public/floating-buttons')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setCfg(d) })
      .catch(() => { /* silent fail */ })
  }, [])

  const wa = cfg?.whatsapp_float_button
  const ctx = floatingWaContext(pathname)
  if (!wa?.enabled || !wa.config.phone || !ctx) return null

  const raised = RAISED_PREFIXES.some((p) => pathname.startsWith(p))
  const bottom = raised
    ? 'bottom-[calc(10rem+env(safe-area-inset-bottom))]'
    : 'bottom-[calc(5rem+env(safe-area-inset-bottom))]'

  return (
    <div className={`fixed ${bottom} right-4 z-40 md:bottom-6 md:right-6 pointer-events-none`}>
      <a
        href={waHref(wa.config.phone, ctx.message)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Escríbenos por WhatsApp"
        onClick={() => track('whatsapp_click', { ref: ctx.ref, placement: 'floating' })}
        className="pointer-events-auto group flex items-center gap-2"
      >
        <span className="hidden md:group-hover:flex items-center rounded-xl bg-[#25D366] px-3 py-1.5 text-xs font-medium text-white shadow-lg whitespace-nowrap">
          Escríbenos por WhatsApp
        </span>
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg hover:bg-[#1ebe5d] active:scale-95 transition-all">
          <WhatsAppIcon className="h-7 w-7" />
        </div>
      </a>
    </div>
  )
}

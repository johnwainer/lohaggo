'use client'

import { useEffect } from 'react'
import WhatsAppIcon, { whatsappHref } from './WhatsAppIcon'

type Props = {
  label: string
  loading?: boolean
  onRequest: () => void
  whatsappPhone: string | null
  whatsappText: string
  onWhatsAppClick?: () => void
  /** Logged-in client/partner bottom navs have a raised center button; sit above it. */
  aboveRaisedNav?: boolean
}

/**
 * Mobile-only fixed CTA above the bottom nav. It leaves the right edge free (w/ `right-[76px]`) when the
 * global WhatsApp float is shown, so it never covers it. Sets `data-sticky-cta` on <body> while mounted.
 */
export default function StickyRequestBar({ label, loading, onRequest, whatsappPhone, whatsappText, onWhatsAppClick, aboveRaisedNav }: Props) {
  useEffect(() => {
    document.body.dataset.stickyCta = '1'
    return () => { delete document.body.dataset.stickyCta }
  }, [])

  return (
    <div
      className={`fixed left-3 z-40 md:hidden ${whatsappPhone ? 'right-[76px]' : 'right-3'} ${aboveRaisedNav ? 'bottom-[calc(6.75rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))]'}`}
    >
      <div className="rounded-3xl border border-gray-200 bg-white/95 p-2 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.25)] backdrop-blur">
        <button
          type="button"
          onClick={onRequest}
          disabled={loading}
          className="flex w-full items-center justify-center rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 px-4 py-3 text-sm font-bold text-white shadow-md disabled:opacity-70"
        >
          {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" /> : <span className="truncate">{label}</span>}
        </button>
        {whatsappPhone && (
          <a
            href={whatsappHref(whatsappPhone, whatsappText)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onWhatsAppClick}
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-semibold text-[#128C7E]"
          >
            <WhatsAppIcon className="h-4 w-4" />
            Pídelo por WhatsApp
          </a>
        )}
      </div>
    </div>
  )
}

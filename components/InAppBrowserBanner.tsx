'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, X, Copy, Check } from 'lucide-react'
import { isInAppBrowser, isAndroid, buildExternalIntentUrl } from '@/lib/inAppBrowser'

const DISMISS_KEY = 'inAppBannerDismissed'

export default function InAppBrowserBanner() {
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)
  const [android, setAndroid] = useState(false)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return
    } catch { /* sessionStorage may be blocked in some webviews */ }
    if (isInAppBrowser()) {
      setShow(true)
      setAndroid(isAndroid())
    }
  }, [])

  if (!show) return null

  const dismiss = () => {
    setShow(false)
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
  }

  const openExternal = () => {
    const url = window.location.href
    const intent = buildExternalIntentUrl(url)
    if (intent) {
      window.location.href = intent
      return
    }
    // iOS / fallback: try a normal new-tab open, then copy the link.
    try { window.open(url, '_blank') } catch { /* ignore */ }
    copyLink()
  }

  const copyLink = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard often unavailable in webviews — leave the URL visible instead
      window.prompt('Copia este enlace y ábrelo en tu navegador:', url)
    }
  }

  return (
    <div className="sticky top-0 z-[70] bg-gradient-to-r from-primary-600 to-secondary-600 text-white shadow-md">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Mejor experiencia en tu navegador</p>
          <p className="text-xs text-white/80 leading-tight">
            {android
              ? 'Toca "Abrir en navegador" para evitar errores al iniciar sesión o subir documentos.'
              : 'Toca ⋯ (arriba a la derecha) y elige "Abrir en el navegador".'}
          </p>
        </div>
        <button
          type="button"
          onClick={android ? openExternal : copyLink}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-primary-700 active:scale-95 transition"
        >
          {android ? (
            <><ExternalLink className="h-3.5 w-3.5" /> Abrir</>
          ) : copied ? (
            <><Check className="h-3.5 w-3.5" /> Copiado</>
          ) : (
            <><Copy className="h-3.5 w-3.5" /> Copiar link</>
          )}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar aviso"
          className="shrink-0 rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

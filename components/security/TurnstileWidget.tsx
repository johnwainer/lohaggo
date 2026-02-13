'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          action?: string
          callback: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
        }
      ) => string
      reset: (widgetId?: string) => void
      remove?: (widgetId?: string) => void
    }
  }
}

interface TurnstileWidgetProps {
  siteKey: string
  action?: string
  onTokenChange: (token: string) => void
}

export default function TurnstileWidget({ siteKey, action, onTokenChange }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    const scriptId = 'cf-turnstile-script'

    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile || widgetIdRef.current) return

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action,
        callback: (token) => onTokenChange(token),
        'expired-callback': () => onTokenChange(''),
        'error-callback': () => onTokenChange(''),
      })
    }

    if (window.turnstile) {
      renderWidget()
      return
    }

    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null
    if (existingScript) {
      existingScript.addEventListener('load', renderWidget)
      return () => existingScript.removeEventListener('load', renderWidget)
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.addEventListener('load', renderWidget)
    document.head.appendChild(script)

    return () => {
      script.removeEventListener('load', renderWidget)
    }
  }, [siteKey, action, onTokenChange])

  useEffect(() => {
    return () => {
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current)
      }
    }
  }, [])

  return <div ref={containerRef} />
}

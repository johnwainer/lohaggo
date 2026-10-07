'use client'

import * as React from 'react'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Everything a modal or sheet needs to behave as a dialog for keyboards and screen readers:
 * Escape closes, the page behind does not scroll, focus moves inside on open, Tab stays inside,
 * and focus goes back to the button that opened it on close.
 *
 * Spread `dialogProps` on the panel element (it sets role, aria-modal, aria-labelledby and tabIndex)
 * and put `titleId` on the dialog's heading.
 */
export function useDialog(open: boolean, onClose: () => void, opts: { dismissible?: boolean; initialFocus?: 'panel' | 'first' } = {}) {
  const { dismissible = true, initialFocus = 'first' } = opts
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const titleId = React.useId()
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose

  React.useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const raf = window.requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel) return
      if (panel.contains(document.activeElement)) return
      const autofocus = panel.querySelector<HTMLElement>('[autofocus],[data-autofocus]')
      const first = initialFocus === 'first' ? panel.querySelector<HTMLElement>(FOCUSABLE) : null
      ;(autofocus || first || panel).focus({ preventScroll: true })
    })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)
      if (!items.length) { e.preventDefault(); panel.focus(); return }
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)

    return () => {
      window.cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true })
    }
  }, [open, dismissible, initialFocus])

  return {
    panelRef,
    titleId,
    dialogProps: {
      ref: panelRef,
      role: 'dialog' as const,
      'aria-modal': true as const,
      'aria-labelledby': titleId,
      tabIndex: -1,
    },
  }
}

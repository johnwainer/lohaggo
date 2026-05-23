'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  showCloseButton?: boolean
  dismissible?: boolean
  className?: string
}

export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  showCloseButton = true,
  dismissible = true,
  className,
}: BottomSheetProps) {
  const [mounted, setMounted] = React.useState(false)
  const sheetRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  React.useEffect(() => {
    if (!open || !dismissible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, dismissible, onClose])

  React.useEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(() => {
      sheetRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(id)
  }, [open])

  if (!mounted || !open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'bottom-sheet-title' : undefined}
    >
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={dismissible ? onClose : undefined}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in cursor-default"
      />
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={cn(
          'relative w-full max-w-2xl bg-white rounded-t-3xl shadow-sheet outline-none',
          'animate-sheet-in flex flex-col',
          'max-h-[90vh] pb-[env(safe-area-inset-bottom)]',
          className,
        )}
      >
        <div className="flex justify-center pt-3 pb-1" aria-hidden="true">
          <span className="h-1.5 w-12 rounded-full bg-slate-200" />
        </div>

        {(title || showCloseButton) && (
          <div className="flex items-start justify-between gap-3 px-5 pt-2 pb-3">
            <div className="min-w-0 flex-1">
              {title && (
                <h2
                  id="bottom-sheet-title"
                  className="text-lg font-semibold text-slate-900 leading-tight"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 text-sm text-slate-500">{description}</p>
              )}
            </div>
            {showCloseButton && dismissible && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="-mr-2 -mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 active:bg-slate-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>

        {footer && (
          <div className="border-t border-slate-100 px-5 py-4">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}

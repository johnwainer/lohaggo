'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDialog } from '@/components/ui/use-dialog'

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
  /** Accessible name when there is no visible title */
  ariaLabel?: string
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
  ariaLabel,
}: BottomSheetProps) {
  const [mounted, setMounted] = React.useState(false)
  const { dialogProps, titleId } = useDialog(open, onClose, { dismissible })

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
    >
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={dismissible ? onClose : undefined}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in cursor-default"
      />
      <div
        {...dialogProps}
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        className={cn(
          'relative w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-sheet outline-none',
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
                  id={titleId}
                  className="text-lg font-semibold text-slate-900 leading-tight"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 text-sm text-slate-600">{description}</p>
              )}
            </div>
            {showCloseButton && dismissible && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="-mr-2 -mt-1 inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 active:bg-slate-200 transition-colors"
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

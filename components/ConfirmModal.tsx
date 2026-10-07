'use client'

import { X, AlertTriangle } from 'lucide-react'
import { useDialog } from '@/components/ui/use-dialog'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info' | 'success' | 'error'
}

const typeStyles = {
  danger: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-700',
    button: 'bg-red-600 hover:bg-red-700'
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: 'text-yellow-800',
    button: 'bg-yellow-700 hover:bg-yellow-800'
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-700',
    button: 'bg-blue-600 hover:bg-blue-700'
  },
  success: {
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    icon: 'text-primary-700',
    button: 'bg-primary-600 hover:bg-primary-700'
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-700',
    button: 'bg-red-600 hover:bg-red-700'
  }
}

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'warning'
}: ConfirmModalProps) {
  const { dialogProps, titleId } = useDialog(isOpen, onClose)

  if (!isOpen) return null

  const styles = typeStyles[type]

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  // z-[200]: confirmations can open on top of other dialogs (z-[100]).
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        {...dialogProps}
        className="relative z-[201] flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-xl animate-fadeIn focus:outline-none"
      >
        <div className={`${styles.bg} ${styles.border} border-b py-2 pl-6 pr-2 shrink-0`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`w-6 h-6 shrink-0 ${styles.icon}`} aria-hidden="true" />
              <h3 id={titleId} className={`text-lg font-semibold ${styles.icon}`}>
                {title}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${styles.icon} transition-colors hover:bg-black/5 ${focusRing}`}
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 overflow-y-auto overscroll-contain">
          <p className="text-gray-700 whitespace-pre-line">
            {message}
          </p>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex flex-wrap justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className={`min-h-[44px] rounded-full border border-gray-300 bg-white px-5 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 ${focusRing}`}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`min-h-[44px] rounded-full px-5 py-2 font-semibold text-white transition-colors ${styles.button} ${focusRing}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

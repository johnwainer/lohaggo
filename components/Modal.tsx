'use client'

import { X } from 'lucide-react'
import { useEffect, ReactNode } from 'react'

interface ModalProps {
  isOpen?: boolean
  onClose: () => void
  title: string
  message?: string
  type?: 'success' | 'error' | 'warning' | 'info'
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void
  showCancel?: boolean
  children?: ReactNode
}

export default function Modal({
  isOpen = true,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  onConfirm,
  showCancel = false,
  children
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const typeStyles = {
    success: {
      bg: 'bg-primary-50',
      border: 'border-primary-200',
      icon: 'text-secondary-600',
      button: 'bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600'
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: 'text-red-600',
      button: 'bg-red-600 hover:bg-red-700'
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      icon: 'text-yellow-600',
      button: 'bg-yellow-600 hover:bg-yellow-700'
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: 'text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700'
    }
  }

  const styles = typeStyles[type]

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm()
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Height-capped + internal scroll so the action buttons stay reachable on
          short viewports (e.g. Facebook/Instagram in-app browsers, where the
          panel previously overflowed off-screen → dead click). */}
      <div className="relative flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-xl animate-fadeIn">
        <div className={`${styles.bg} ${styles.border} border-b px-6 py-4 rounded-t-lg shrink-0`}>
          <div className="flex items-center justify-between">
            <h3 className={`text-lg font-semibold ${styles.icon}`}>
              {title}
            </h3>
            <button
              onClick={onClose}
              className={`${styles.icon} hover:opacity-70 transition-opacity`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 overflow-y-auto overscroll-contain">
          {children ? children : (
            <p className="text-gray-700 whitespace-pre-line">
              {message}
            </p>
          )}
        </div>

        {!children && (
          <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3 shrink-0">
            {showCancel && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {cancelText}
              </button>
            )}
            <button
              onClick={handleConfirm}
              className={`px-4 py-2 text-white rounded-lg transition-colors ${styles.button}`}
            >
              {confirmText}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

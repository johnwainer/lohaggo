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
      bg: 'bg-green-50',
      border: 'border-green-200',
      icon: 'text-green-600',
      button: 'bg-green-600 hover:bg-green-700'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full animate-fadeIn">
        <div className={`${styles.bg} ${styles.border} border-b px-6 py-4 rounded-t-lg`}>
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

        <div className="px-6 py-4">
          {children ? children : (
            <p className="text-gray-700 whitespace-pre-line">
              {message}
            </p>
          )}
        </div>

        {!children && (
          <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
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

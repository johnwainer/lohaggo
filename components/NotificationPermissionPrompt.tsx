'use client'

import { useState, useEffect } from 'react'
import { Bell, X, CheckCircle, AlertCircle } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'

interface NotificationPermissionPromptProps {
  onClose?: () => void
  autoShow?: boolean
}

export default function NotificationPermissionPrompt({ 
  onClose, 
  autoShow = true 
}: NotificationPermissionPromptProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)
  const { 
    isSupported, 
    isSubscribed, 
    permission, 
    isLoading, 
    error, 
    subscribeToPush 
  } = usePushNotifications()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const dismissed = localStorage.getItem('notification-prompt-dismissed')
    const lastShown = localStorage.getItem('notification-prompt-last-shown')
    const now = Date.now()
    const threeDays = 3 * 24 * 60 * 60 * 1000

    if (dismissed === 'true' && lastShown) {
      const timeSinceLastShown = now - parseInt(lastShown)
      if (timeSinceLastShown < threeDays) {
        return
      }
    }

    if (autoShow && isSupported && !isSubscribed && permission === 'default') {
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [autoShow, isSupported, isSubscribed, permission])

  const handleEnable = async () => {
    setHasInteracted(true)
    const success = await subscribeToPush()
    
    if (success) {
      setTimeout(() => {
        handleClose()
      }, 2000)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem('notification-prompt-dismissed', 'true')
    localStorage.setItem('notification-prompt-last-shown', Date.now().toString())
    handleClose()
  }

  const handleClose = () => {
    setIsVisible(false)
    onClose?.()
  }

  if (!isVisible || !isSupported || isSubscribed || permission === 'denied') {
    return null
  }

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
        onClick={handleDismiss}
      />
      
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-50 animate-slide-up">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          <div className="relative bg-gradient-to-r from-primary-600 to-primary-700 p-4 sm:p-6">
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 text-white/80 hover:text-white transition"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-3 rounded-full">
                <Bell className="text-white" size={24} />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">
                  Activa las notificaciones
                </h3>
                <p className="text-white/90 text-sm">
                  No te pierdas ninguna actualización
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="space-y-3 mb-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-medium text-gray-900 text-sm">Actualizaciones en tiempo real</p>
                  <p className="text-gray-600 text-xs">Recibe notificaciones instantáneas de tus reservas</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-medium text-gray-900 text-sm">Nuevas propuestas</p>
                  <p className="text-gray-600 text-xs">Entérate cuando recibas nuevas ofertas</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-medium text-gray-900 text-sm">Cambios de estado</p>
                  <p className="text-gray-600 text-xs">Mantente informado del progreso de tus servicios</p>
                </div>
              </div>
            </div>

            {error && hasInteracted && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={16} />
                <p className="text-red-800 text-xs">{error}</p>
              </div>
            )}

            {isSubscribed && hasInteracted && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <CheckCircle className="text-green-600" size={16} />
                <p className="text-green-800 text-sm font-medium">¡Notificaciones activadas!</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleDismiss}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Ahora no
              </button>
              <button
                onClick={handleEnable}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Activando...' : 'Activar'}
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center mt-3">
              Puedes cambiar esto en cualquier momento desde la configuración
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        
        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
      `}</style>
    </>
  )
}

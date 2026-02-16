'use client';

import { useEffect, useState } from 'react';
import { X, Download, RefreshCw } from 'lucide-react';
import { trackPwaEvent } from '@/lib/pwa/telemetry-client';
import { PWA_EVENTS } from '@/lib/pwa/events';
import { useSession } from 'next-auth/react';

export default function PWAInstallPrompt() {
  const { data: session } = useSession();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://');
    
    setIsStandalone(isStandaloneMode);

    const handleBeforeInstallPrompt = (e: Event) => {
      const installDismissed = localStorage.getItem('pwa-install-dismissed');
      const dismissedTime = installDismissed ? parseInt(installDismissed) : 0;
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

      if (!installDismissed || daysSinceDismissed > 7) {
        e.preventDefault();
        setDeferredPrompt(e);
        setTimeout(() => {
          setShowInstallPrompt(true);
          trackPwaEvent({ eventName: PWA_EVENTS.INSTALL_PROMPT_SHOWN, source: 'global_install_prompt' });
        }, 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    trackPwaEvent({ eventName: PWA_EVENTS.INSTALL_CLICKED, source: 'global_install_prompt' });
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
    }

    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismissInstall = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    trackPwaEvent({ eventName: PWA_EVENTS.INSTALL_PROMPT_DISMISSED, source: 'global_install_prompt' });
  };

  const handleUpdateClick = () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
    setShowUpdatePrompt(false);
  };

  if (session?.user?.id || isStandalone || (!showInstallPrompt && !showUpdatePrompt)) {
    return null;
  }

  return (
    <>
      {showInstallPrompt && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-2xl shadow-2xl border-2 border-gray-100 z-50 animate-slide-up">
          <div className="bg-gradient-to-r from-primary-500 to-secondary-500 p-4 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                  <img src="/icon.svg" alt="LoHaggo" className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">Instalar LoHaggo</h3>
                  <p className="text-white/90 text-sm">Acceso rápido desde tu inicio</p>
                </div>
              </div>
              <button
                onClick={handleDismissInstall}
                className="text-white/80 hover:text-white transition-colors"
                aria-label="Cerrar"
              >
                <X size={24} />
              </button>
            </div>
          </div>
          
          <div className="p-4">
            <ul className="space-y-2 mb-4 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
                Acceso instantáneo sin abrir el navegador
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
                Funciona sin conexión a internet
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
                Notificaciones de tus reservas
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
                Experiencia nativa como una app
              </li>
            </ul>
            
            <button
              onClick={handleInstallClick}
              className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 text-white py-3 rounded-xl font-bold hover:from-primary-600 hover:to-secondary-600 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Download size={20} />
              Instalar Aplicación
            </button>
            
            <button
              onClick={handleDismissInstall}
              className="w-full mt-2 text-gray-500 hover:text-gray-700 py-2 text-sm font-medium transition-colors"
            >
              Ahora no
            </button>
          </div>
        </div>
      )}

      {showUpdatePrompt && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-2xl shadow-2xl border-2 border-gray-100 z-50 animate-slide-up">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center">
                <RefreshCw size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Nueva versión disponible</h3>
                <p className="text-sm text-gray-600">Actualiza para obtener las últimas mejoras</p>
              </div>
            </div>
            
            <button
              onClick={handleUpdateClick}
              className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 text-white py-3 rounded-xl font-bold hover:from-primary-600 hover:to-secondary-600 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw size={18} />
              Actualizar Ahora
            </button>
          </div>
        </div>
      )}
    </>
  );
}

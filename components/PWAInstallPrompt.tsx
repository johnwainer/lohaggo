'use client';

import { useEffect, useState } from 'react';
import { X, Download, RefreshCw } from 'lucide-react';
import { trackPwaEvent } from '@/lib/pwa/telemetry-client';
import { PWA_EVENTS } from '@/lib/pwa/events';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';

const VISIT_COUNT_KEY = 'pwa-visit-count';
const INSTALL_DISMISSED_KEY = 'pwa-install-dismissed';
const MIN_VISITS_TO_SHOW = 3;

export default function PWAInstallPrompt() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  // Track whether terms banner is still visible (hasn't been accepted yet)
  const [termsAccepted, setTermsAccepted] = useState(true);

  useEffect(() => {
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://');
    setIsStandalone(isStandaloneMode);

    // Check if terms have been accepted already
    setTermsAccepted(Boolean(localStorage.getItem('terms-accepted')));

    // Increment visit counter
    const currentCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10);
    const newCount = currentCount + 1;
    localStorage.setItem(VISIT_COUNT_KEY, String(newCount));

    const handleBeforeInstallPrompt = (e: Event) => {
      const installDismissed = localStorage.getItem(INSTALL_DISMISSED_KEY);
      const dismissedTime = installDismissed ? parseInt(installDismissed) : 0;
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

      // Only show after MIN_VISITS_TO_SHOW visits and if not recently dismissed.
      // Respect the user's dismiss for 30 days (antes era 7) — menos fricción si dijeron "no".
      if (newCount >= MIN_VISITS_TO_SHOW && (!installDismissed || daysSinceDismissed > 30)) {
        e.preventDefault();
        setDeferredPrompt(e);
        setTimeout(() => {
          // Re-check terms state at the time of showing
          const accepted = Boolean(localStorage.getItem('terms-accepted'));
          if (accepted) {
            setShowInstallPrompt(true);
            trackPwaEvent({ eventName: PWA_EVENTS.INSTALL_PROMPT_SHOWN, source: 'global_install_prompt' });
          } else {
            // Delay until terms are accepted — poll briefly
            const poll = setInterval(() => {
              if (localStorage.getItem('terms-accepted')) {
                clearInterval(poll);
                setShowInstallPrompt(true);
                trackPwaEvent({ eventName: PWA_EVENTS.INSTALL_PROMPT_SHOWN, source: 'global_install_prompt' });
              }
            }, 1000);
            // Stop polling after 2 minutes
            setTimeout(() => clearInterval(poll), 120000);
          }
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
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismissInstall = () => {
    setShowInstallPrompt(false);
    localStorage.setItem(INSTALL_DISMISSED_KEY, Date.now().toString());
    trackPwaEvent({ eventName: PWA_EVENTS.INSTALL_PROMPT_DISMISSED, source: 'global_install_prompt' });
  };

  const handleUpdateClick = () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
    setShowUpdatePrompt(false);
  };

  if (pathname?.startsWith('/unete') || session?.user?.id || isStandalone || (!showInstallPrompt && !showUpdatePrompt)) {
    return null;
  }

  return (
    <>
      {showInstallPrompt && (
        /* Compact toast on mobile (con márgenes laterales para no tapar cards),
           card on desktop. Wrapper pointer-events-none por defensa: si alguna vez el
           wrapper es más grande que el contenido visible, los clicks pasan al contenido detrás. */
        <div className="fixed bottom-[5.5rem] left-3 right-3 max-w-md mx-auto md:bottom-4 md:left-auto md:right-4 md:mx-0 md:max-w-sm z-40 pointer-events-none animate-slide-up">
        <div className="pointer-events-auto bg-white rounded-2xl shadow-2xl border border-gray-100">
          {/* Toast compacto unificado (mobile + desktop): mínimo footprint para no tapar cards */}
          <div className="flex items-center gap-3 px-4 py-3">
            <img src="/icon.svg" alt="LoHaggo" className="w-8 h-8 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 leading-tight">Instalar LoHaggo</p>
              <p className="text-xs text-gray-500 truncate">Acceso rápido desde tu pantalla de inicio</p>
            </div>
            <button
              onClick={handleInstallClick}
              className="flex-shrink-0 bg-primary-500 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-1"
            >
              <Download size={14} />
              Instalar
            </button>
            <button onClick={handleDismissInstall} className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors" aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>
        </div>
        </div>
      )}

      {showUpdatePrompt && (
        <div className="fixed bottom-28 left-4 right-4 md:bottom-4 md:left-auto md:right-4 md:w-96 z-40 pointer-events-none animate-slide-up">
        <div className="pointer-events-auto bg-white rounded-2xl shadow-2xl border-2 border-gray-100">
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
        </div>
      )}
    </>
  );
}

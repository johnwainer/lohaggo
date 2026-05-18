'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { KeyRound, X, ChevronRight, ShieldAlert } from 'lucide-react'

export default function PasswordUpdateBanner() {
  const { data: session } = useSession()
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)

  if (!session?.user?.needsPasswordUpdate || dismissed) return null

  return (
    <div
      role="alert"
      className="relative z-30 w-full border-b border-amber-300 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3">
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 rounded-lg bg-amber-100 p-1.5 text-amber-700">
            <ShieldAlert className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>

          {/* Text */}
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-amber-900 leading-snug">
              <span className="font-semibold">Acceso temporal activo.</span>
              <span className="hidden sm:inline"> Crea tu contraseña para poder ingresar normalmente la próxima vez.</span>
              <span className="sm:hidden"> Crea tu contraseña.</span>
            </p>
          </div>

          {/* CTA */}
          <button
            onClick={() => router.push('/profile?section=password')}
            className="flex-shrink-0 inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-white hover:bg-amber-700 active:scale-95 transition whitespace-nowrap"
          >
            <KeyRound className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="hidden sm:inline">Actualizar contraseña</span>
            <span className="sm:hidden">Actualizar</span>
            <ChevronRight className="h-3 w-3 opacity-70" />
          </button>

          {/* Dismiss */}
          <button
            onClick={() => setDismissed(true)}
            aria-label="Cerrar aviso"
            className="flex-shrink-0 rounded-lg p-1 text-amber-600 hover:bg-amber-100 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

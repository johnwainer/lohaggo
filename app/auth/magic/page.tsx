'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, ShieldCheck, AlertCircle, KeyRound } from 'lucide-react'

type State = 'loading' | 'error' | 'success'

export default function MagicLinkPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, setState] = useState<State>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setErrorMsg('Enlace inválido. No se encontró el token.')
      setState('error')
      return
    }

    fetch(`/api/auth/magic/validate?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Error al validar el enlace.')
        }
        setState('success')
        // Brief success flash, then redirect
        setTimeout(() => {
          router.replace(data.redirectUrl || '/partner/verification')
        }, 1200)
      })
      .catch((err) => {
        setErrorMsg(err.message || 'No se pudo procesar el enlace.')
        setState('error')
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100 px-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 p-8 text-center">
          {/* Logo */}
          <div className="mb-6 flex justify-center">
            <img
              src="https://www.lohaggo.com/icon-512.png"
              alt="LoHaggo"
              className="h-14 w-14 rounded-2xl shadow-md"
            />
          </div>

          {state === 'loading' && (
            <>
              <div className="flex justify-center mb-4">
                <Loader2 className="h-10 w-10 text-primary-600 animate-spin" />
              </div>
              <h1 className="text-lg font-bold text-slate-900 mb-2">Verificando tu acceso</h1>
              <p className="text-sm text-slate-500">Un momento, estamos iniciando tu sesión de forma segura…</p>
            </>
          )}

          {state === 'success' && (
            <>
              <div className="flex justify-center mb-4">
                <div className="rounded-2xl bg-emerald-100 p-3">
                  <ShieldCheck className="h-10 w-10 text-emerald-600" />
                </div>
              </div>
              <h1 className="text-lg font-bold text-slate-900 mb-2">¡Acceso confirmado!</h1>
              <p className="text-sm text-slate-500">Redirigiendo a tu panel…</p>
              <div className="mt-4 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-1 bg-emerald-500 rounded-full animate-[progress_1.2s_ease-in-out_forwards]" />
              </div>
            </>
          )}

          {state === 'error' && (
            <>
              <div className="flex justify-center mb-4">
                <div className="rounded-2xl bg-red-100 p-3">
                  <AlertCircle className="h-10 w-10 text-red-500" />
                </div>
              </div>
              <h1 className="text-lg font-bold text-slate-900 mb-2">Enlace no válido</h1>
              <p className="text-sm text-slate-600 mb-6">{errorMsg}</p>

              <div className="space-y-3">
                <a
                  href="/login"
                  className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 transition"
                >
                  <KeyRound className="h-4 w-4" />
                  Iniciar sesión
                </a>
                <a
                  href="/login?forgot=1"
                  className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Recuperar contraseña
                </a>
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          LoHaggo · Acceso seguro de un solo uso
        </p>
      </div>
    </div>
  )
}

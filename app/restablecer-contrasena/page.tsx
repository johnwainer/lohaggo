'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Lock, Star, AlertCircle, CheckCircle2 } from 'lucide-react'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('El enlace de recuperación no es válido o está incompleto.')
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!token) return
    
    if (password.length < 8) {
      setStatus('error')
      setMessage('La contraseña debe tener mínimo 8 caracteres.')
      return
    }
    
    if (password !== confirmPassword) {
      setStatus('error')
      setMessage('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    setStatus('idle')

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, newPassword: password }),
      })

      const data = await res.json()

      if (res.ok) {
        setStatus('success')
        setMessage('¡Tu contraseña ha sido actualizada con éxito!')
        setTimeout(() => {
          router.push('/login?reset=success')
        }, 3000)
      } else {
        setStatus('error')
        setMessage(data.error || 'Ocurrió un error. Inténtalo de nuevo.')
      }
    } catch (err) {
      setStatus('error')
      setMessage('Hubo un problema de conexión. Verifica tu internet y vuelve a intentar.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="bg-white py-8 px-6 shadow-2xl rounded-3xl border border-gray-100 sm:px-10 text-center">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded m-4 flex items-center justify-center font-medium">
          <AlertCircle className="inline w-5 h-5 mr-2" />
          Enlace inválido o expirado.
        </div>
        <Link href="/olvide-mi-contrasena" className="text-primary-600 font-bold underline mt-4 block p-2">
          Volver a solicitar recuperación
        </Link>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="bg-white py-12 px-6 shadow-2xl rounded-3xl border border-gray-100 sm:px-10 text-center">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-2xl font-black text-gray-900 mb-4">{message}</h3>
        <p className="text-gray-600 font-medium mb-8">
          Inicia sesión con tu nueva contraseña. Redirigiendo...
        </p>
        <Link 
          href="/login"
          className="w-full inline-flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm leading-5 font-bold text-white bg-primary-600 hover:bg-primary-700"
        >
          Iniciar sesión ahora
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white py-8 px-6 shadow-2xl rounded-3xl border border-gray-100 sm:px-10">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <p className="text-sm font-medium text-gray-700 text-center mb-4">
          Crea tu nueva contraseña. Asegúrate de escoger una contraseña segura.
        </p>
      
        {status === 'error' && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 flex items-start">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
            <p className="text-sm text-red-700 font-medium">{message}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Nueva Contraseña</label>
          <div className="relative mt-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm font-medium transition-all"
              placeholder="Min. 8 caracteres"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Confirmar Contraseña</label>
          <div className="relative mt-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm font-medium transition-all"
              placeholder="Confirmar contraseña"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-gradient-to-r from-primary-600 to-secondary-600 hover:from-primary-700 hover:to-secondary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute top-0 inset-x-0 h-64 bg-slate-900 rounded-b-[4rem] md:rounded-b-[8rem] shadow-xl"></div>
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center mb-6">
          <Link href="/" className="flex items-center space-x-2 group relative">
            <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-md shadow-lg group-hover:bg-white/30 transition-all border border-white/20">
              <Star className="w-8 h-8 text-white fill-current" />
            </div>
            <span className="text-3xl font-black tracking-tight text-white drop-shadow-md">
              LoHaggo
            </span>
          </Link>
        </div>
        
        <h2 className="text-center text-3xl font-extrabold text-white sm:text-4xl drop-shadow-lg mb-8">
          Nueva Contraseña
        </h2>
      </div>

      <div className="mt-2 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <Suspense fallback={<div className="text-center font-bold p-10 bg-white rounded-3xl shadow-xl">Cargando...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>

      <div className="mt-8 text-center border-t border-transparent pt-6 relative z-10">
        <Link
          href="/login"
          className="inline-flex items-center text-sm font-bold text-gray-500 hover:text-primary-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  )
}

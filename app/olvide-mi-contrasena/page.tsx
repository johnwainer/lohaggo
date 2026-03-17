'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    setStatus('idle')

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (res.ok) {
        setStatus('success')
        setMessage(data.message || 'Si el correo está registrado, te hemos enviado las instrucciones.')
      } else {
        setStatus('error')
        setMessage(data.error || 'Ocurrió un error. Inténtalo más tarde.')
      }
    } catch (err) {
      setStatus('error')
      setMessage('Hubo un problema de conexión. Verifica tu internet y vuelve a intentar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-br from-primary-600 to-secondary-600 rounded-b-[4rem] md:rounded-b-[8rem] shadow-xl"></div>
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center mb-6">
          <Link href="/" className="flex items-center space-x-2 group relative">
            <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-md shadow-lg group-hover:bg-white/30 transition-all border border-white/20">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <span className="text-3xl font-black tracking-tight text-white drop-shadow-md">
              LoHaggo
            </span>
          </Link>
        </div>
        
        <h2 className="text-center text-3xl font-extrabold text-white sm:text-4xl drop-shadow-lg mb-8">
          Recuperar Contraseña
        </h2>
      </div>

      <div className="mt-2 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-3xl border border-gray-100 sm:px-10">
          
          {status === 'success' ? (
            <div className="text-center py-6">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">¡Revisa tu correo!</h3>
              <p className="text-gray-600 mb-8">{message}</p>
              
              <Link 
                href="/login"
                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all"
              >
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <p className="text-sm text-gray-600 text-center mb-6">
                Ingresa el correo electrónico asociado a tu cuenta y te enviaremos un enlace para restablecer tu contraseña.
              </p>

              {status === 'error' && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md mb-6 flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                  <p className="text-sm text-red-700 font-medium">{message}</p>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-1">
                  Correo electrónico
                </label>
                <div className="relative mt-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm font-medium transition-all"
                    placeholder="tu@correo.com"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-gradient-to-r from-primary-600 to-secondary-600 hover:from-primary-700 hover:to-secondary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                </button>
              </div>
              
              <div className="mt-8 text-center border-t border-gray-100 pt-6">
                <Link
                  href="/login"
                  className="inline-flex items-center text-sm font-bold text-primary-600 hover:text-primary-500 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver al inicio de sesión
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

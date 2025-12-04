'use client'

import { useState, useEffect, Suspense } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/dashboard'
  const { data: session, status } = useSession()

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const targetRedirect = searchParams.get('redirect')

      if (session.user.role === 'ADMIN') {
        router.push(targetRedirect || '/admin')
        router.refresh()
      } else if (session.user.role === 'PARTNER') {
        router.push(targetRedirect || '/partner')
        router.refresh()
      } else {
        router.push(targetRedirect || '/dashboard')
        router.refresh()
      }
    }
  }, [status, session, router, searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!acceptedTerms) {
      setError('Debes aceptar los Términos y Condiciones y la Política de Privacidad para continuar')
      return
    }

    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false
      })

      if (result?.error) {
        setError('Email o contraseña incorrectos')
        setLoading(false)
      } else if (result?.ok) {
        // Fetch the session to get user role
        const response = await fetch('/api/auth/session')
        const sessionData = await response.json()

        if (sessionData?.user?.role === 'ADMIN') {
          window.location.href = searchParams.get('redirect') || '/admin'
        } else if (sessionData?.user?.role === 'PARTNER') {
          window.location.href = searchParams.get('redirect') || '/partner'
        } else {
          window.location.href = searchParams.get('redirect') || '/dashboard'
        }
      }
    } catch (error) {
      setError('Error al iniciar sesión')
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Iniciar sesión</h2>
            <p className="mt-2 text-gray-600">Accede a tu cuenta</p>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="tu@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="accepted-terms"
                  aria-describedby="accepted-terms-description"
                  name="accepted-terms"
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="w-4 h-4 text-primary-600 bg-white border-gray-300 rounded focus:ring-primary-500"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="accepted-terms" className="font-medium text-gray-700">
                  Acepto los{' '}
                  <Link href="/terms" className="text-primary-600 hover:text-primary-700">
                    términos y condiciones
                  </Link>
                </label>
                <p id="accepted-terms-description" className="text-gray-500">
                  Debes aceptar para poder iniciar sesión.
                </p>
              </div>
            </div>

            {/* Terms and Conditions Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center mt-0.5">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="w-5 h-5 border-2 border-gray-300 rounded cursor-pointer checked:bg-[#FF2D55] checked:border-[#FF2D55] focus:ring-2 focus:ring-[#FF2D55] focus:ring-offset-2 transition-all"
                    required
                  />
                </div>
                <span className="text-sm text-gray-700 leading-relaxed">
                  He leído y acepto los{' '}
                  <Link
                    href="/terms"
                    target="_blank"
                    className="text-[#FF2D55] font-semibold hover:underline"
                  >
                    Términos y Condiciones
                  </Link>
                  , la{' '}
                  <Link
                    href="/privacy"
                    target="_blank"
                    className="text-[#FF2D55] font-semibold hover:underline"
                  >
                    Política de Privacidad
                  </Link>
                  {' '}y la{' '}
                  <Link
                    href="/cookies"
                    target="_blank"
                    className="text-[#FF2D55] font-semibold hover:underline"
                  >
                    Política de Cookies
                  </Link>
                  .
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || !acceptedTerms}
              className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              ¿No tienes cuenta?{' '}
              <Link href="/register" className="text-primary-600 hover:text-primary-700 font-medium">
                Regístrate aquí
              </Link>
            </p>
          </div>

          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-gray-500 text-center">
              Usuarios de prueba:
            </p>
            <div className="mt-2 space-y-1 text-xs text-gray-600">
              <p>Cliente: cliente@test.com / password123</p>
              <p>Socio: socio1@test.com / password123</p>
              <p>Admin: admin@servicios.com / password123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600"></div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}

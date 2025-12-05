'use client'

import { useState, useEffect, Suspense } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, ArrowRight, Sparkles, Shield, Zap } from 'lucide-react'

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
      <div className="min-h-screen bg-gradient-to-br from-[#FF2D55] via-[#FF3D00] to-[#FF6900] flex items-center justify-center">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white"></div>
          <div className="absolute inset-0 rounded-full h-16 w-16 border-t-4 border-white/30 animate-pulse"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FF2D55] via-[#FF3D00] to-[#FF6900] relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
      <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 animate-pulse delay-1000"></div>
      
      <div className="relative min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl w-full grid lg:grid-cols-2 gap-8 items-center">
          <div className="hidden lg:block text-white space-y-8 animate-fade-in">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                <Sparkles className="w-5 h-5" />
                <span className="text-sm font-medium">Bienvenido de vuelta</span>
              </div>
              <h1 className="text-5xl font-bold leading-tight">
                LoHaggo<br />
                <span className="text-white/90">Lo necesitas</span>
              </h1>
              <p className="text-xl text-white/80">
                Accede a tu cuenta y encuentra los mejores servicios en tu ciudad
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm p-4 rounded-2xl">
                <div className="bg-white/20 p-3 rounded-xl">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">100% Seguro</h3>
                  <p className="text-sm text-white/70">Tus datos están protegidos con encriptación de última generación</p>
                </div>
              </div>
              <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm p-4 rounded-2xl">
                <div className="bg-white/20 p-3 rounded-xl">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Acceso Instantáneo</h3>
                  <p className="text-sm text-white/70">Conecta con profesionales verificados en segundos</p>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full">
            <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-10 backdrop-blur-sm animate-slide-up">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#FF2D55] via-[#FF3D00] to-[#FF6900] rounded-2xl mb-4 shadow-lg">
                  <Lock className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900">Iniciar sesión</h2>
                <p className="mt-2 text-gray-600">Ingresa tus credenciales para continuar</p>
              </div>

              {error && (
                <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg animate-shake">
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Email
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-[#FF2D55] transition-colors" size={20} />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF2D55]/20 focus:border-[#FF2D55] outline-none transition-all"
                      placeholder="tu@email.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Contraseña
                  </label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-[#FF2D55] transition-colors" size={20} />
                    <input
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF2D55]/20 focus:border-[#FF2D55] outline-none transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-0.5">
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="w-5 h-5 border-2 border-gray-300 rounded-lg cursor-pointer checked:bg-[#FF2D55] checked:border-[#FF2D55] focus:ring-2 focus:ring-[#FF2D55]/20 focus:ring-offset-2 transition-all"
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
                  className="w-full bg-gradient-to-r from-[#FF2D55] via-[#FF3D00] to-[#FF6900] text-white py-4 rounded-xl hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 group"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Iniciando sesión...</span>
                    </>
                  ) : (
                    <>
                      <span>Iniciar sesión</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 text-center">
                <p className="text-gray-600">
                  ¿No tienes cuenta?{' '}
                  <Link href="/register" className="text-[#FF2D55] hover:text-[#FF6B8A] font-semibold hover:underline transition-colors">
                    Regístrate aquí
                  </Link>
                </p>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-200">
                <p className="text-sm text-gray-500 text-center mb-3 font-medium">
                  Usuarios de prueba:
                </p>
                <div className="space-y-2 text-xs text-gray-600 bg-gray-50 p-4 rounded-xl">
                  <p className="flex justify-between">
                    <span className="font-medium">Cliente:</span>
                    <span>cliente@test.com / password123</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="font-medium">Socio:</span>
                    <span>socio1@test.com / password123</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="font-medium">Admin:</span>
                    <span>admin@servicios.com / password123</span>
                  </p>
                </div>
              </div>
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
        <div className="min-h-screen bg-gradient-to-br from-[#FF2D55] via-[#FF3D00] to-[#FF6900] flex items-center justify-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white"></div>
            <div className="absolute inset-0 rounded-full h-16 w-16 border-t-4 border-white/30 animate-pulse"></div>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}

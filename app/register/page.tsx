'use client'

import { useEffect, useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, User, Phone, MapPin, Check, ArrowRight, Sparkles, Shield, Zap } from 'lucide-react'
import { useCity } from '@/lib/city-context'
import { formatCurrency } from '@/lib/utils'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roleParam = searchParams.get('role')
  const { cities, loading: citiesLoading } = useCity()

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: roleParam === 'partner' ? 'PARTNER' : 'CLIENT',
    city: '',
    services: [] as string[],
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [servicesCatalog, setServicesCatalog] = useState<
    Array<{ id: string; name: string; slug: string; basePrice?: number }>
  >([])

  useEffect(() => {
    if (cities.length > 0 && !formData.city) {
      const activeCity = cities.find((c) => c.status === 'ACTIVE')
      const defaultCity = activeCity || cities[0]
      setFormData((prev) => ({ ...prev, city: defaultCity.slug }))
    }
  }, [cities, formData.city])

  useEffect(() => {
    if (formData.role === 'PARTNER') {
      fetch('/api/services')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setServicesCatalog(
              data.map((service: any) => ({
                id: service.id,
                name: service.name,
                slug: service.slug,
                basePrice: service.basePrice,
              }))
            )
          } else {
            setServicesCatalog([])
          }
        })
        .catch((err) => {
          console.error('Error fetching services', err)
          setServicesCatalog([])
        })
    } else {
      setServicesCatalog([])
      setFormData((prev) => ({ ...prev, services: [] }))
    }
  }, [formData.role])

  const toggleService = (slug: string) => {
    setFormData((prev) => {
      const alreadySelected = prev.services.includes(slug)

      if (!alreadySelected && prev.services.length >= 5) {
        alert('Solo puedes seleccionar un máximo de 5 servicios')
        return prev
      }

      return {
        ...prev,
        services: alreadySelected
          ? prev.services.filter((serviceSlug) => serviceSlug !== slug)
          : [...prev.services, slug],
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!acceptedTerms) {
      setError('Debes aceptar los Términos y Condiciones y la Política de Privacidad para continuar')
      return
    }

    setLoading(true)

    try {
      const payload = {
        ...formData,
        city: formData.city,
        services: formData.role === 'PARTNER' ? formData.services : [],
      }

      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al registrar')
        setLoading(false)
        return
      }

      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })

      if (result?.error) {
        setError('Registro exitoso pero error al iniciar sesión')
      } else {
        if (formData.role === 'PARTNER') {
          const selectedCity = cities.find(c => c.slug === formData.city)
          if (selectedCity?.status === 'COMING_SOON') {
            router.push(`/partner/welcome/${formData.city}`)
          } else {
            router.push('/partner')
          }
        } else {
          router.push('/dashboard')
        }
        router.refresh()
      }
    } catch (error) {
      setError('Error al registrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FF2D55] via-[#FF3D00] to-[#FF6900] relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2 animate-pulse delay-1000"></div>

      <div className="relative min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl w-full grid lg:grid-cols-2 gap-8 items-center">
          <div className="hidden lg:block text-white space-y-8 animate-fade-in">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                <Sparkles className="w-5 h-5" />
                <span className="text-sm font-medium">Únete a la comunidad</span>
              </div>
              <h1 className="text-5xl font-bold leading-tight">
                Comienza tu<br />
                <span className="text-white/90">experiencia</span>
              </h1>
              <p className="text-xl text-white/80">
                Crea tu cuenta y accede a miles de servicios profesionales verificados
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm p-4 rounded-2xl">
                <div className="bg-white/20 p-3 rounded-xl">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Verificación Completa</h3>
                  <p className="text-sm text-white/70">Todos nuestros profesionales están verificados y certificados</p>
                </div>
              </div>
              <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm p-4 rounded-2xl">
                <div className="bg-white/20 p-3 rounded-xl">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Respuesta Rápida</h3>
                  <p className="text-sm text-white/70">Recibe propuestas en minutos y elige la mejor opción</p>
                </div>
              </div>
              <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm p-4 rounded-2xl">
                <div className="bg-white/20 p-3 rounded-xl">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Perfil Personalizado</h3>
                  <p className="text-sm text-white/70">Gestiona tus servicios y pagos desde un solo lugar</p>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full">
            <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-10 backdrop-blur-sm animate-slide-up">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#FF2D55] via-[#FF3D00] to-[#FF6900] rounded-2xl mb-4 shadow-lg">
                  <User className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900">Crear cuenta</h2>
                <p className="mt-2 text-gray-600">Únete a nuestra plataforma y comienza hoy</p>
              </div>

            {error && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg">
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Tipo de cuenta
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'CLIENT' })}
                    className={`relative py-4 px-4 rounded-xl border-2 transition-all ${
                      formData.role === 'CLIENT'
                        ? 'border-[#FF2D55] bg-[#FF2D55]/5 shadow-lg scale-105'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <User className={`w-6 h-6 ${formData.role === 'CLIENT' ? 'text-[#FF2D55]' : 'text-gray-400'}`} />
                      <span className={`font-semibold ${formData.role === 'CLIENT' ? 'text-[#FF2D55]' : 'text-gray-700'}`}>
                        Cliente
                      </span>
                    </div>
                    {formData.role === 'CLIENT' && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#FF2D55] rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'PARTNER' })}
                    className={`relative py-4 px-4 rounded-xl border-2 transition-all ${
                      formData.role === 'PARTNER'
                        ? 'border-[#FF2D55] bg-[#FF2D55]/5 shadow-lg scale-105'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <User className={`w-6 h-6 ${formData.role === 'PARTNER' ? 'text-[#FF2D55]' : 'text-gray-400'}`} />
                      <span className={`font-semibold ${formData.role === 'PARTNER' ? 'text-[#FF2D55]' : 'text-gray-700'}`}>
                        Socio
                      </span>
                    </div>
                    {formData.role === 'PARTNER' && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#FF2D55] rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Nombre completo
                </label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-[#FF2D55] transition-colors" size={20} />
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF2D55] focus:border-transparent outline-none transition-all hover:border-gray-300"
                    placeholder="Juan Pérez"
                  />
                </div>
              </div>

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
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF2D55] focus:border-transparent outline-none transition-all hover:border-gray-300"
                    placeholder="tu@email.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Teléfono
                </label>
                <div className="relative group">
                  <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-[#FF2D55] transition-colors" size={20} />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF2D55] focus:border-transparent outline-none transition-all hover:border-gray-300"
                    placeholder="+1234567890"
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
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF2D55]/20 focus:border-[#FF2D55] outline-none transition-all"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Ciudad
                </label>
                <div className="relative group">
                  <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-[#FF2D55] transition-colors" size={20} />
                  <select
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF2D55]/20 focus:border-[#FF2D55] outline-none transition-all appearance-none bg-white"
                    required
                  >
                    {cities.map((city) => (
                      <option
                        key={city.id}
                        value={city.slug}
                      >
                        {city.name}{' '}
                        {city.status === 'COMING_SOON'
                          ? '(próximamente)'
                          : city.status === 'INACTIVE'
                          ? '(no disponible)'
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

            {formData.role === 'PARTNER' && (
              <div className="space-y-4 pt-2 border-t border-gray-200">

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Servicios que ofreces (máximo 5)
                    </label>
                    <span className={`text-xs font-medium ${formData.services.length >= 5 ? 'text-red-600' : 'text-gray-500'}`}>
                      {formData.services.length}/5 seleccionados
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl divide-y">
                    {servicesCatalog.length === 0 ? (
                      <div className="p-4 text-sm text-gray-500 text-center">
                        Cargando catálogo de servicios...
                      </div>
                    ) : (
                      servicesCatalog.map((service) => {
                        const selected = formData.services.includes(service.slug)
                        const isDisabled = !selected && formData.services.length >= 5
                        return (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => toggleService(service.slug)}
                            disabled={isDisabled}
                            className={`w-full flex items-center justify-between px-4 py-3 text-left transition ${
                              selected
                                ? 'bg-[#FF2D55]/5 text-[#FF2D55] font-semibold'
                                : isDisabled
                                ? 'bg-gray-50 opacity-50 cursor-not-allowed'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <div>
                              <p className="text-sm font-medium">{service.name}</p>
                              {service.basePrice && (
                                <p className="text-xs text-gray-500">
                                  Desde {formatCurrency(service.basePrice)}
                                </p>
                              )}
                            </div>
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-full border-2 transition ${
                                selected
                                  ? 'border-[#FF2D55] bg-[#FF2D55] text-white'
                                  : 'border-gray-300 text-gray-300'
                              }`}
                            >
                              {selected && <Check size={14} />}
                            </span>
                          </button>
                        )
                      })
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Podrás ajustar tus servicios y precios desde tu panel una vez te registres.
                  </p>
                </div>
              </div>
            )}

            {/* Terms and Conditions Checkbox */}
            <div className="pt-4 border-t border-gray-200">
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
                  <span>Creando cuenta...</span>
                </>
              ) : (
                <>
                  <span>Crear cuenta</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-600">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-[#FF2D55] hover:text-[#FF6B8A] font-semibold hover:underline transition-colors">
                Inicia sesión aquí
              </Link>
            </p>
          </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
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
      <RegisterForm />
    </Suspense>
  )
}

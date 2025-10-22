'use client'

import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, User, Phone, MapPin, Check } from 'lucide-react'
import { CITY_OPTIONS, CityId } from '@/lib/city-context'
import { formatCurrency } from '@/lib/utils'

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roleParam = searchParams.get('role')

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: roleParam === 'partner' ? 'PARTNER' : 'CLIENT',
    city: 'MEDELLIN' as CityId,
    services: [] as string[],
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [servicesCatalog, setServicesCatalog] = useState<
    Array<{ id: string; name: string; slug: string; basePrice?: number }>
  >([])

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
          router.push('/partner')
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
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Crear cuenta</h2>
            <p className="mt-2 text-gray-600">Únete a nuestra plataforma</p>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de cuenta
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'CLIENT' })}
                  className={`py-3 px-4 rounded-lg border-2 transition ${
                    formData.role === 'CLIENT'
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  Cliente
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'PARTNER' })}
                  className={`py-3 px-4 rounded-lg border-2 transition ${
                    formData.role === 'PARTNER'
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  Socio
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre completo
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="Juan Pérez"
                />
              </div>
            </div>

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
                Teléfono
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="+1234567890"
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
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="••••••••"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">Mínimo 6 caracteres</p>
            </div>

            {formData.role === 'PARTNER' && (
              <div className="space-y-4 pt-2 border-t border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ciudad principal de operación
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FF2D55]" size={18} />
                    <select
                      value={formData.city}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          city: e.target.value as CityId,
                        }))
                      }
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none appearance-none bg-white"
                    >
                      {CITY_OPTIONS.map((city) => (
                        <option key={city.id} value={city.id} disabled={!city.active}>
                          {city.name} {!city.active ? '(próximamente)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Servicios que ofreces
                    </label>
                    <span className="text-xs text-gray-500">
                      {formData.services.length} seleccionados
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
                        return (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => toggleService(service.slug)}
                            className={`w-full flex items-center justify-between px-4 py-3 text-left transition ${
                              selected
                                ? 'bg-[#FF2D55]/5 text-[#FF2D55] font-semibold'
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
                  {' '}de LoHaggo.
                </span>
              </label>
              <p className="mt-2 text-xs text-gray-500 ml-8">
                Al registrarte, confirmas que has leído, entendido y aceptado nuestras políticas.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !acceptedTerms}
              className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Registrando...' : 'Crear cuenta'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                Inicia sesión aquí
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

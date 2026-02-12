'use client'

import { useEffect, useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, User, Phone, MapPin, Check, ArrowRight, Sparkles, Shield, Zap, DollarSign, Clock, Users, Star, Search, Eye, EyeOff } from 'lucide-react'
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
    confirmPassword: '',
    phone: '',
    role: roleParam === 'partner' ? 'PARTNER' : 'CLIENT',
    city: '',
    services: [] as string[],
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [servicesError, setServicesError] = useState('')
  const [servicesCatalog, setServicesCatalog] = useState<
    Array<{ id: string; name: string; slug: string; basePrice?: number }>
  >([])
  const [fieldErrors, setFieldErrors] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: ''
  })
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    password: false,
    confirmPassword: false,
    phone: false
  })
  const [passwordStrength, setPasswordStrength] = useState<{
    level: 'weak' | 'medium' | 'strong' | null
    score: number
    feedback: string[]
  }>({
    level: null,
    score: 0,
    feedback: []
  })

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
          if (data.services && Array.isArray(data.services)) {
            setServicesCatalog(
              data.services.map((service: any) => ({
                id: service.id,
                name: service.name,
                slug: service.slug,
                basePrice: service.basePrice,
              }))
            )
          } else if (Array.isArray(data)) {
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

  const validateName = (name: string) => {
    if (!name) {
      return 'El nombre es obligatorio'
    }
    if (name.length < 2) {
      return 'El nombre debe tener al menos 2 caracteres'
    }
    return ''
  }

  const validateEmail = (email: string) => {
    if (!email) {
      return 'El correo electrónico es obligatorio'
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return 'Por favor ingresa un correo electrónico válido'
    }
    return ''
  }

  const calculatePasswordStrength = (password: string) => {
    if (!password) {
      return { level: null, score: 0, feedback: [] } as {
        level: 'weak' | 'medium' | 'strong' | null
        score: number
        feedback: string[]
      }
    }

    let score = 0
    const feedback: string[] = []

    if (password.length >= 8) {
      score += 25
    } else {
      feedback.push('Usa al menos 8 caracteres')
    }

    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
      score += 25
    } else {
      feedback.push('Incluye mayúsculas y minúsculas')
    }

    if (/[0-9]/.test(password)) {
      score += 25
    } else {
      feedback.push('Incluye al menos un número')
    }

    if (/[^A-Za-z0-9]/.test(password)) {
      score += 25
    } else {
      feedback.push('Incluye un carácter especial (!@#$%^&*)')
    }

    let level: 'weak' | 'medium' | 'strong' | null = null
    if (score >= 75) {
      level = 'strong'
    } else if (score >= 50) {
      level = 'medium'
    } else if (score > 0) {
      level = 'weak'
    }

    return { level, score, feedback }
  }

  const validatePassword = (password: string) => {
    if (!password) {
      return 'La contraseña es obligatoria'
    }
    if (password.length < 8) {
      return 'La contraseña debe tener al menos 8 caracteres'
    }
    if (!/[A-Z]/.test(password)) {
      return 'La contraseña debe incluir al menos una mayúscula'
    }
    if (!/[a-z]/.test(password)) {
      return 'La contraseña debe incluir al menos una minúscula'
    }
    if (!/[0-9]/.test(password)) {
      return 'La contraseña debe incluir al menos un número'
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      return 'La contraseña debe incluir al menos un carácter especial (!@#$%^&*)'
    }
    return ''
  }

  const validatePhone = (phone: string) => {
    if (!phone) {
      return 'El teléfono es obligatorio'
    }
    const cleanPhone = phone.replace(/\s/g, '')
    if (!/^[0-9]{10}$/.test(cleanPhone)) {
      return 'El teléfono debe tener 10 dígitos'
    }
    if (!cleanPhone.startsWith('3')) {
      return 'El teléfono debe comenzar con 3 (formato colombiano)'
    }
    return ''
  }

  const validateConfirmPassword = (confirmPassword: string, password: string) => {
    if (!confirmPassword) {
      return 'Por favor confirma tu contraseña'
    }
    if (confirmPassword !== password) {
      return 'Las contraseñas no coinciden'
    }
    return ''
  }

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '')
    const limited = cleaned.slice(0, 10)

    if (limited.length <= 3) {
      return limited
    } else if (limited.length <= 6) {
      return `${limited.slice(0, 3)} ${limited.slice(3)}`
    } else {
      return `${limited.slice(0, 3)} ${limited.slice(3, 6)} ${limited.slice(6)}`
    }
  }

  const handleFieldChange = (field: string, value: string) => {
    let processedValue = value

    if (field === 'phone') {
      processedValue = formatPhoneNumber(value)
    }

    setFormData({ ...formData, [field]: processedValue })

    if (field === 'password') {
      const strength = calculatePasswordStrength(value)
      setPasswordStrength(strength)

      if (touched.confirmPassword && formData.confirmPassword) {
        const confirmError = validateConfirmPassword(formData.confirmPassword, value)
        setFieldErrors({ ...fieldErrors, password: '', confirmPassword: confirmError })
        return
      }
    }

    if (field === 'confirmPassword') {
      if (touched.confirmPassword) {
        const error = validateConfirmPassword(value, formData.password)
        setFieldErrors({ ...fieldErrors, confirmPassword: error })
      }
      return
    }

    if (touched[field as keyof typeof touched]) {
      let error = ''
      switch (field) {
        case 'name':
          error = validateName(processedValue)
          break
        case 'email':
          error = validateEmail(processedValue)
          break
        case 'password':
          error = validatePassword(processedValue)
          break
        case 'phone':
          error = validatePhone(processedValue)
          break
      }
      setFieldErrors({ ...fieldErrors, [field]: error })
    }
  }

  const handleFieldBlur = (field: string) => {
    setTouched({ ...touched, [field]: true })
    let error = ''
    switch (field) {
      case 'name':
        error = validateName(formData.name)
        break
      case 'email':
        error = validateEmail(formData.email)
        break
      case 'password':
        error = validatePassword(formData.password)
        break
      case 'confirmPassword':
        error = validateConfirmPassword(formData.confirmPassword, formData.password)
        break
      case 'phone':
        error = validatePhone(formData.phone)
        break
    }
    setFieldErrors({ ...fieldErrors, [field]: error })
  }

  const toggleService = (slug: string) => {
    setFormData((prev) => {
      const alreadySelected = prev.services.includes(slug)

      if (!alreadySelected && prev.services.length >= 5) {
        alert('Solo puedes seleccionar un máximo de 5 servicios')
        return prev
      }

      const newServices = alreadySelected
        ? prev.services.filter((serviceSlug) => serviceSlug !== slug)
        : [...prev.services, slug]

      if (newServices.length > 0) {
        setServicesError('')
      }

      return {
        ...prev,
        services: newServices,
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setServicesError('')

    setTouched({ name: true, email: true, password: true, confirmPassword: true, phone: true })
    const nameError = validateName(formData.name)
    const emailError = validateEmail(formData.email)
    const passwordError = validatePassword(formData.password)
    const confirmPasswordError = validateConfirmPassword(formData.confirmPassword, formData.password)
    const phoneError = validatePhone(formData.phone)

    setFieldErrors({
      name: nameError,
      email: emailError,
      password: passwordError,
      confirmPassword: confirmPasswordError,
      phone: phoneError
    })

    if (nameError || emailError || passwordError || confirmPasswordError || phoneError) {
      return
    }

    if (formData.role === 'PARTNER' && formData.services.length === 0) {
      setServicesError('Debes seleccionar al menos 1 servicio que ofreces')
      return
    }

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
    <div className="min-h-screen bg-gradient-to-br from-primary-500 via-secondary-500 to-secondary-500 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2 animate-pulse delay-1000"></div>

      <div className="relative min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl w-full grid lg:grid-cols-2 gap-8 items-center">
          <div className="hidden lg:block text-white space-y-8 animate-fade-in">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                <Sparkles className="w-5 h-5" />
                <span className="text-sm font-medium">
                  {formData.role === 'PARTNER' ? 'Únete como profesional' : 'Únete a la comunidad'}
                </span>
              </div>
              <h1 className="text-5xl font-bold leading-tight">
                {formData.role === 'PARTNER' ? (
                  <>
                    Gana dinero<br />
                    <span className="text-white/90">con tu talento</span>
                  </>
                ) : (
                  <>
                    Encuentra el<br />
                    <span className="text-white/90">servicio perfecto</span>
                  </>
                )}
              </h1>
              <p className="text-xl text-white/80">
                {formData.role === 'PARTNER'
                  ? 'Crea tu perfil profesional y conecta con miles de clientes que necesitan tus servicios'
                  : 'Crea tu cuenta y accede a miles de servicios profesionales verificados en tu ciudad'
                }
              </p>
            </div>

            <div className="space-y-4">
              {formData.role === 'PARTNER' ? (
                <>
                  <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm p-4 rounded-2xl">
                    <div className="bg-white/20 p-3 rounded-xl">
                      <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Gana dinero extra</h3>
                      <p className="text-sm text-white/70">Define tus tarifas y recibe pagos seguros después de cada servicio</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm p-4 rounded-2xl">
                    <div className="bg-white/20 p-3 rounded-xl">
                      <Clock className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Horarios flexibles</h3>
                      <p className="text-sm text-white/70">Tú decides cuándo trabajar y qué trabajos aceptar según tu disponibilidad</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm p-4 rounded-2xl">
                    <div className="bg-white/20 p-3 rounded-xl">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Miles de clientes</h3>
                      <p className="text-sm text-white/70">Accede a una red de clientes verificados que buscan tus servicios</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm p-4 rounded-2xl">
                    <div className="bg-white/20 p-3 rounded-xl">
                      <Shield className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Profesionales verificados</h3>
                      <p className="text-sm text-white/70">Todos nuestros profesionales están verificados y certificados</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm p-4 rounded-2xl">
                    <div className="bg-white/20 p-3 rounded-xl">
                      <Zap className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Respuesta rápida</h3>
                      <p className="text-sm text-white/70">Recibe propuestas en minutos y elige la mejor opción para ti</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm p-4 rounded-2xl">
                    <div className="bg-white/20 p-3 rounded-xl">
                      <Star className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Mejores precios</h3>
                      <p className="text-sm text-white/70">Compara múltiples opciones y elige la que mejor se ajuste a tu presupuesto</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="w-full">
            <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-10 backdrop-blur-sm animate-slide-up">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 via-secondary-500 to-secondary-500 rounded-2xl mb-4 shadow-lg">
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
                        ? 'border-primary-500 bg-primary-500/5 shadow-lg scale-105'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <User className={`w-6 h-6 ${formData.role === 'CLIENT' ? 'text-primary-600' : 'text-gray-400'}`} />
                      <span className={`font-semibold ${formData.role === 'CLIENT' ? 'text-primary-600' : 'text-gray-700'}`}>
                        Cliente
                      </span>
                    </div>
                    {formData.role === 'CLIENT' && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'PARTNER' })}
                    className={`relative py-4 px-4 rounded-xl border-2 transition-all ${
                      formData.role === 'PARTNER'
                        ? 'border-primary-500 bg-primary-500/5 shadow-lg scale-105'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <User className={`w-6 h-6 ${formData.role === 'PARTNER' ? 'text-primary-600' : 'text-gray-400'}`} />
                      <span className={`font-semibold ${formData.role === 'PARTNER' ? 'text-primary-600' : 'text-gray-700'}`}>
                        Socio
                      </span>
                    </div>
                    {formData.role === 'PARTNER' && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Nombre completo <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                  <User className={`absolute left-4 top-1/2 transform -translate-y-1/2 transition-colors ${
                    fieldErrors.name && touched.name ? 'text-red-500' : 'text-gray-400 group-focus-within:text-primary-600'
                  }`} size={20} />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    onBlur={() => handleFieldBlur('name')}
                    className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 outline-none transition-all ${
                      fieldErrors.name && touched.name
                        ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                        : 'border-gray-200 focus:ring-primary-500/20 focus:border-primary-500 hover:border-gray-300'
                    }`}
                    placeholder="Juan Pérez"
                  />
                </div>
                {fieldErrors.name && touched.name && (
                  <p className="text-sm text-red-600 flex items-center gap-1 animate-fade-in">
                    <span className="inline-block w-1 h-1 bg-red-600 rounded-full"></span>
                    {fieldErrors.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                  <Mail className={`absolute left-4 top-1/2 transform -translate-y-1/2 transition-colors ${
                    fieldErrors.email && touched.email ? 'text-red-500' : 'text-gray-400 group-focus-within:text-primary-600'
                  }`} size={20} />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    onBlur={() => handleFieldBlur('email')}
                    className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 outline-none transition-all ${
                      fieldErrors.email && touched.email
                        ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                        : 'border-gray-200 focus:ring-primary-500/20 focus:border-primary-500 hover:border-gray-300'
                    }`}
                    placeholder="tu@email.com"
                  />
                </div>
                {fieldErrors.email && touched.email && (
                  <p className="text-sm text-red-600 flex items-center gap-1 animate-fade-in">
                    <span className="inline-block w-1 h-1 bg-red-600 rounded-full"></span>
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Teléfono <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                  <Phone className={`absolute left-4 top-1/2 transform -translate-y-1/2 transition-colors ${
                    fieldErrors.phone && touched.phone ? 'text-red-500' : 'text-gray-400 group-focus-within:text-primary-600'
                  }`} size={20} />
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="tel-national"
                    value={formData.phone}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                    onBlur={() => handleFieldBlur('phone')}
                    className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 outline-none transition-all ${
                      fieldErrors.phone && touched.phone
                        ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                        : 'border-gray-200 focus:ring-primary-500/20 focus:border-primary-500 hover:border-gray-300'
                    }`}
                    placeholder="300 123 4567"
                  />
                </div>
                {fieldErrors.phone && touched.phone && (
                  <p className="text-sm text-red-600 flex items-center gap-1 animate-fade-in">
                    <span className="inline-block w-1 h-1 bg-red-600 rounded-full"></span>
                    {fieldErrors.phone}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Contraseña <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                  <Lock className={`absolute left-4 top-1/2 transform -translate-y-1/2 transition-colors ${
                    fieldErrors.password && touched.password ? 'text-red-500' : 'text-gray-400 group-focus-within:text-primary-600'
                  }`} size={20} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleFieldChange('password', e.target.value)}
                    onBlur={() => handleFieldBlur('password')}
                    className={`w-full pl-12 pr-12 py-3.5 border-2 rounded-xl focus:ring-2 outline-none transition-all ${
                      fieldErrors.password && touched.password
                        ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                        : 'border-gray-200 focus:ring-primary-500/20 focus:border-primary-500'
                    }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                {formData.password && passwordStrength.level && (
                  <div className="space-y-2 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            passwordStrength.level === 'weak'
                              ? 'bg-red-500 w-1/3'
                              : passwordStrength.level === 'medium'
                              ? 'bg-yellow-500 w-2/3'
                              : 'bg-green-500 w-full'
                          }`}
                        />
                      </div>
                      <span
                        className={`text-xs font-semibold ${
                          passwordStrength.level === 'weak'
                            ? 'text-red-600'
                            : passwordStrength.level === 'medium'
                            ? 'text-yellow-600'
                            : 'text-green-600'
                        }`}
                      >
                        {passwordStrength.level === 'weak'
                          ? 'Débil'
                          : passwordStrength.level === 'medium'
                          ? 'Media'
                          : 'Fuerte'}
                      </span>
                    </div>

                    {passwordStrength.feedback.length > 0 && (
                      <div className="space-y-1">
                        {passwordStrength.feedback.map((tip, index) => (
                          <p key={index} className="text-xs text-gray-600 flex items-center gap-1.5">
                            <span className="inline-block w-1 h-1 bg-gray-400 rounded-full"></span>
                            {tip}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {fieldErrors.password && touched.password && (
                  <p className="text-sm text-red-600 flex items-center gap-1 animate-fade-in">
                    <span className="inline-block w-1 h-1 bg-red-600 rounded-full"></span>
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Confirmar contraseña <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                  <Lock className={`absolute left-4 top-1/2 transform -translate-y-1/2 transition-colors ${
                    fieldErrors.confirmPassword && touched.confirmPassword ? 'text-red-500' : 'text-gray-400 group-focus-within:text-primary-600'
                  }`} size={20} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => handleFieldChange('confirmPassword', e.target.value)}
                    onBlur={() => handleFieldBlur('confirmPassword')}
                    className={`w-full pl-12 pr-12 py-3.5 border-2 rounded-xl focus:ring-2 outline-none transition-all ${
                      fieldErrors.confirmPassword && touched.confirmPassword
                        ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                        : 'border-gray-200 focus:ring-primary-500/20 focus:border-primary-500'
                    }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && touched.confirmPassword && (
                  <p className="text-sm text-red-600 flex items-center gap-1 animate-fade-in">
                    <span className="inline-block w-1 h-1 bg-red-600 rounded-full"></span>
                    {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Ciudad <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                  <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-primary-600 transition-colors" size={20} />
                  <select
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all appearance-none bg-white"
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
                      Servicios que ofreces (máximo 5) <span className="text-red-500">*</span>
                    </label>
                    <span className={`text-xs font-medium ${formData.services.length >= 5 ? 'text-red-600' : 'text-gray-500'}`}>
                      {formData.services.length}/5 seleccionados
                    </span>
                  </div>

                  <div className="relative mb-3 group">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-primary-600 transition-colors" size={20} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all hover:border-gray-300"
                      placeholder="Buscar servicios..."
                    />
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl divide-y">
                    {servicesCatalog.length === 0 ? (
                      <div className="p-4 text-sm text-gray-500 text-center">
                        Cargando catálogo de servicios...
                      </div>
                    ) : (
                      (() => {
                        const filteredServices = servicesCatalog.filter((service) =>
                          service.name.toLowerCase().includes(searchQuery.toLowerCase())
                        )

                        if (filteredServices.length === 0) {
                          return (
                            <div className="p-4 text-sm text-gray-500 text-center">
                              No se encontraron servicios que coincidan con tu búsqueda
                            </div>
                          )
                        }

                        return filteredServices.map((service) => {
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
                                  ? 'bg-primary-500/5 text-primary-600 font-semibold'
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
                                    ? 'border-primary-500 bg-primary-500 text-white'
                                    : 'border-gray-300 text-gray-300'
                                }`}
                              >
                                {selected && <Check size={14} />}
                              </span>
                            </button>
                          )
                        })
                      })()
                    )}
                  </div>
                  {servicesError && (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1 animate-fade-in">
                      <span className="inline-block w-1 h-1 bg-red-600 rounded-full"></span>
                      {servicesError}
                    </p>
                  )}
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
                    className="w-5 h-5 border-2 border-gray-300 rounded-lg cursor-pointer checked:bg-primary-500 checked:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:ring-offset-2 transition-all"
                    required
                  />
                </div>
                <span className="text-sm text-gray-700 leading-relaxed">
                  He leído y acepto los{' '}
                  <Link
                    href="/terms"
                    target="_blank"
                    className="text-primary-600 font-semibold hover:underline"
                  >
                    Términos y Condiciones
                  </Link>
                  , la{' '}
                  <Link
                    href="/privacy"
                    target="_blank"
                    className="text-primary-600 font-semibold hover:underline"
                  >
                    Política de Privacidad
                  </Link>
                  {' '}y la{' '}
                  <Link
                    href="/cookies"
                    target="_blank"
                    className="text-primary-600 font-semibold hover:underline"
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
              className="w-full bg-gradient-to-r from-primary-500 via-secondary-500 to-secondary-500 text-white py-4 rounded-xl hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 group"
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
              <Link href="/login" className="text-primary-600 hover:text-primary-400 font-semibold hover:underline transition-colors">
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
        <div className="min-h-screen bg-gradient-to-br from-primary-500 via-secondary-500 to-secondary-500 flex items-center justify-center">
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

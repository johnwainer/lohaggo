'use client'

import { useEffect, useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    Mail,
    Lock,
    User,
    Phone,
    MapPin,
    Check,
    ArrowRight,
    Sparkles,
    Search,
    Eye,
    EyeOff,
    DollarSign,
    Clock,
    Shield,
    Star
} from 'lucide-react'
import { useCity } from '@/lib/city-context'
import { formatCurrency } from '@/lib/utils'
import TurnstileWidget from '@/components/security/TurnstileWidget'
import { trackPwaEvent } from '@/lib/pwa/telemetry-client'
import { PWA_EVENTS } from '@/lib/pwa/events'
import { trackEvent } from '@/components/analytics/MetaPixel'

function SqueezeForm() {
    const router = useRouter()
    const { cities, loading: citiesLoading } = useCity()

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        phone: '',
        role: 'PARTNER',
        city: '',
        services: [] as string[],
    })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [acceptedTerms, setAcceptedTerms] = useState(false)
    const [showSuccessModal, setShowSuccessModal] = useState(false)
    const [captchaToken, setCaptchaToken] = useState('')
    const [honeypot, setHoneypot] = useState('')
    const [formStartedAt] = useState(() => Date.now().toString())
    const [searchQuery, setSearchQuery] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [servicesError, setServicesError] = useState('')
    const [servicesCatalog, setServicesCatalog] = useState<
        Array<{ id: string; name: string; slug: string; basePrice?: number }>
    >([])

    const [step, setStep] = useState(1)

    const [fieldErrors, setFieldErrors] = useState({
        name: '',
        email: '',
        password: '',
        phone: '',
    })
    const [touched, setTouched] = useState({
        name: false,
        email: false,
        password: false,
        phone: false,
    })

    const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''
    const isBotProtectionEnabled = Boolean(turnstileSiteKey)

    useEffect(() => {
        // Esconder barras de navegacion globales para enfocarse en la landing
        const hideGlobalElements = () => {
            document.querySelectorAll('nav, footer').forEach((el) => {
                if (el instanceof HTMLElement) el.style.display = 'none'
            })
            // Ocultar bottom navigation de PWA si existe
            document.querySelectorAll('div[class*="fixed bottom-0 z-40"]').forEach((el) => {
                if (el instanceof HTMLElement) el.style.display = 'none'
            })
        }
        hideGlobalElements()
        // Run again slightly later to catch delayed renders
        setTimeout(hideGlobalElements, 500)
        return () => {
            document.querySelectorAll('nav, footer').forEach((el) => {
                if (el instanceof HTMLElement) el.style.display = ''
            })
            document.querySelectorAll('div[class*="fixed bottom-0 z-40"]').forEach((el) => {
                if (el instanceof HTMLElement) el.style.display = ''
            })
        }
    }, [])

    useEffect(() => {
        if (cities.length > 0 && !formData.city) {
            const medellin = cities.find((c) => c.slug === 'medellin')
            const defaultCity = medellin || cities.find((c) => c.status === 'ACTIVE') || cities[0]
            setFormData((prev) => ({ ...prev, city: defaultCity.slug }))
        }

        const container = document.getElementById('unete-container')
        if (container) container.scrollTo(0, 0)
        window.scrollTo(0, 0)
    }, [cities, formData.city])

    useEffect(() => {
        fetch('/api/services')
            .then((res) => res.json())
            .then((data) => {
                const catalog = data.services || data
                if (Array.isArray(catalog)) {
                    setServicesCatalog(
                        catalog.map((service: any) => ({
                            id: service.id,
                            name: service.name,
                            slug: service.slug,
                            basePrice: service.basePrice,
                        }))
                    )
                }
            })
            .catch((err) => {
                console.error('Error fetching services', err)
            })
    }, [])

    const validateName = (name: string) => (!name ? 'El nombre es obligatorio' : name.length < 2 ? 'Debe tener al menos 2 caracteres' : '')
    const validateEmail = (email: string) => (!email ? 'El correo es obligatorio' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Correo inválido' : '')
    const validatePhone = (phone: string) => {
        if (!phone) return 'El teléfono es obligatorio'
        const clean = phone.replace(/\s/g, '')
        if (!/^[0-9]{10}$/.test(clean)) return 'El teléfono debe tener 10 dígitos'
        if (!clean.startsWith('3')) return 'Debe comenzar con 3 (formato colombiano)'
        return ''
    }
    const validatePassword = (password: string) => (!password ? 'La contraseña es obligatoria' : password.length < 8 ? 'Mínimo 8 caracteres' : '')

    type ValidatableField = keyof typeof fieldErrors

    const formatPhoneNumber = (value: string) => {
        const cleaned = value.replace(/\D/g, '').slice(0, 10)
        if (cleaned.length <= 3) return cleaned
        if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`
        return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`
    }

    const handleFieldChange = (field: string, value: string) => {
        const val = field === 'phone' ? formatPhoneNumber(value) : value
        setFormData((prev) => ({ ...prev, [field]: val }))
    }

    const handleFieldBlur = (field: keyof typeof touched) => {
        setTouched((prev) => ({ ...prev, [field]: true }))
        const errorMap: Record<string, string> = {
            name: validateName(formData.name),
            email: validateEmail(formData.email),
            phone: validatePhone(formData.phone),
            password: validatePassword(formData.password)
        }
        setFieldErrors((prev) => ({ ...prev, [field]: errorMap[field] }))
    }

    const toggleService = (slug: string) => {
        setFormData((prev) => {
            const alreadySelected = prev.services.includes(slug)
            if (!alreadySelected && prev.services.length >= 5) {
                alert('Máximo 5 servicios')
                return prev
            }
            return {
                ...prev,
                services: alreadySelected ? prev.services.filter((s) => s !== slug) : [...prev.services, slug]
            }
        })
    }

    const nextStep = () => {
        if (step === 1) {
            setTouched({ ...touched, name: true, phone: true })
            const errorN = validateName(formData.name)
            const errorP = validatePhone(formData.phone)
            setFieldErrors({ ...fieldErrors, name: errorN, phone: errorP })
            if (!errorN && !errorP) setStep(2)
        } else if (step === 2) {
            if (formData.services.length === 0) {
                setServicesError('Debes seleccionar al menos 1 servicio')
                return
            }
            setServicesError('')
            setStep(3)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setTouched({ ...touched, email: true, password: true })
        const errorE = validateEmail(formData.email)
        const errorPw = validatePassword(formData.password)
        setFieldErrors({ ...fieldErrors, email: errorE, password: errorPw })

        if (errorE || errorPw) return
        if (!acceptedTerms) {
            setError('Acepta los Términos para continuar')
            return
        }
        if (honeypot.trim()) return
        if (isBotProtectionEnabled && !captchaToken) {
            setError('Completa la verificación anti-bot.')
            return
        }

        setLoading(true)

        try {
            const payload = { ...formData, captchaToken, honeypot, formStartedAt }
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Error al registrar')

            const result = await signIn('credentials', {
                email: formData.email,
                password: formData.password,
                redirect: false,
            })

            if (result?.error) {
                throw new Error('Registro exitoso pero error al iniciar sesión')
            } else {
                router.refresh()
                localStorage.setItem('pwa-onboarding-force', '1')
                trackPwaEvent({
                    eventName: PWA_EVENTS.SIGNUP_COMPLETED,
                    role: 'PARTNER',
                    source: 'unete_ads_landing',
                })
                try {
                    trackEvent('CompleteRegistration', { value: 0, currency: 'COP' })
                } catch (e) { }
                setLoading(false)
                setShowSuccessModal(true)
            }
        } catch (err: any) {
            setError(err.message || 'Error al registrar')
            setLoading(false)
        }
    }

    return (
        <div id="unete-container" className="min-h-screen bg-slate-50 flex flex-col md:flex-row absolute inset-0 z-[100] overflow-y-auto">
            {/* Columna Izquierda / Hero de la Landing */}
            <div className="w-full md:w-5/12 bg-gradient-to-br from-primary-600 via-primary-500 to-secondary-500 text-white p-8 md:p-12 flex flex-col justify-between order-2 md:order-1">
                <div>
                    <Link href="/" className="inline-flex items-center space-x-2 group">
                        <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-2xl font-black tracking-tight text-white">LoHaggo Pro</span>
                    </Link>

                    <div className="mt-12 space-y-6">
                        <h1 className="text-2xl leading-snug md:text-5xl font-extrabold md:leading-tight">
                            Aumenta tus ingresos arreglando y solucionando lo que sabes.
                        </h1>
                        <p className="text-white/80 text-lg md:text-xl font-medium">
                            Conviértete en socio de la plataforma líder y recibe clientes en tu ciudad cada día. Sin jefes, maneja tu propio tiempo y aumenta tus ingresos.
                        </p>

                        <div className="mt-8 bg-white/10 p-5 rounded-2xl border border-white/20 backdrop-blur-sm shadow-xl md:mr-8 transition-transform hover:scale-[1.02]">
                            <div className="flex items-start gap-4">
                                <div className="bg-yellow-400 text-yellow-900 text-2xl w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg shadow-yellow-400/20 leading-none pb-1">
                                    🛵
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white mb-1 flex items-center gap-2">
                                        LoHaggo Ya Favor <span className="bg-yellow-400 text-yellow-900 text-[10px] uppercase font-black px-2 py-0.5 rounded-full tracking-wider">Top</span>
                                    </h3>
                                    <p className="text-white/90 text-sm md:text-base leading-relaxed font-medium">
                                        Encargos y diligencias express: compra, recogida y entrega en minutos.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 space-y-6 hidden md:block">
                        <div className="flex items-center gap-4 text-white">
                            <div className="bg-white/10 p-3 rounded-full"><DollarSign size={24} /></div>
                            <div className="flex-1 font-semibold">Decide cuánto ganas. Cero suscripciones para entrar.</div>
                        </div>
                        <div className="flex items-center gap-4 text-white">
                            <div className="bg-white/10 p-3 rounded-full"><Clock size={24} /></div>
                            <div className="flex-1 font-semibold">Tú controlas tu tiempo.</div>
                        </div>
                        <div className="flex items-center gap-4 text-white">
                            <div className="bg-white/10 p-3 rounded-full"><Shield size={24} /></div>
                            <div className="flex-1 font-semibold">Soporte y pagos protegidos por LoHaggo.</div>
                        </div>
                    </div>
                </div>

                {/* Social Proof Mobile/Desktop */}
                <div className="mt-12 pt-8 border-t border-white/20">
                    <div className="flex items-center gap-4">
                        <div className="flex -space-x-3">
                            <div className="w-10 h-10 rounded-full border-2 border-primary-500 bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-800 shadow-sm">CR</div>
                            <div className="w-10 h-10 rounded-full border-2 border-primary-500 bg-slate-300 flex items-center justify-center font-bold text-xs text-slate-800 shadow-sm">MA</div>
                            <div className="w-10 h-10 rounded-full border-2 border-primary-500 bg-secondary-400 flex items-center justify-center font-bold text-xs text-white shadow-sm">+500</div>
                        </div>
                        <div className="text-sm">
                            <div className="flex text-yellow-300"><Star size={14} fill="currentColor" /><Star size={14} fill="currentColor" /><Star size={14} fill="currentColor" /><Star size={14} fill="currentColor" /><Star size={14} fill="currentColor" /></div>
                            <span className="font-semibold text-white/90">Socios activos hoy</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Columna Derecha / Formulario (Diseño Wizard / Funnel) */}
            <div className="w-full md:w-7/12 flex items-center justify-center p-6 md:p-12 order-1 md:order-2">
                <div className="max-w-md w-full animate-fade-in">
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-black text-gray-900">Registro rápido</h2>
                            <span className="text-sm font-bold text-primary-500 bg-primary-50 px-3 py-1 rounded-full">Paso {step} de 3</span>
                        </div>

                        <div className="hidden h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-primary-500 transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }}></div>
                        </div>
                    </div>

                    <form onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); nextStep(); }} className="space-y-5 relative">

                        {/* ------------ PASO 1 : Captura Inicial ------------ */}
                        <div className={`transition-all duration-300 ${step === 1 ? 'opacity-100 translate-x-0 block' : 'opacity-0 translate-x-10 hidden'}`}>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-gray-700">Tu nombre completo</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <input
                                            type="text"
                                            className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition font-medium text-gray-800"
                                            placeholder="Ej. Carlos Rodríguez"
                                            value={formData.name}
                                            onChange={(e) => handleFieldChange('name', e.target.value)}
                                            onBlur={() => handleFieldBlur('name')}
                                        />
                                    </div>
                                    {fieldErrors.name && touched.name && <p className="text-xs text-red-600 font-semibold">{fieldErrors.name}</p>}
                                </div>

                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-gray-700">Teléfono (WhatsApp)</label>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <input
                                            type="tel"
                                            className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition font-medium text-gray-800"
                                            placeholder="300 000 0000"
                                            value={formData.phone}
                                            onChange={(e) => handleFieldChange('phone', e.target.value)}
                                            onBlur={() => handleFieldBlur('phone')}
                                        />
                                    </div>
                                    {fieldErrors.phone && touched.phone && <p className="text-xs text-red-600 font-semibold">{fieldErrors.phone}</p>}
                                </div>
                            </div>

                            <button type="button" onClick={nextStep} className="mt-8 w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all">
                                Continuar <ArrowRight size={18} />
                            </button>
                        </div>

                        {/* ------------ PASO 2 : Especialidad ------------ */}
                        <div className={`transition-all duration-300 ${step === 2 ? 'opacity-100 translate-x-0 block' : 'opacity-0 translate-x-10 hidden'}`}>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-gray-700">Tu ciudad principal</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <select
                                            value={formData.city}
                                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                            disabled={true}
                                            className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl outline-none font-bold text-gray-800 bg-gray-100 cursor-not-allowed opacity-90"
                                        >
                                            {cities.length > 0 ? cities.map((city) => (
                                                <option key={city.id} value={city.slug} disabled={city.status === 'INACTIVE'}>
                                                    {city.name} {city.status === 'COMING_SOON' && '(próximamente)'}
                                                </option>
                                            )) : (
                                                <option value="medellin">Medellín</option>
                                            )}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between items-end">
                                        <label className="text-sm font-bold text-gray-700">¿Qué servicios ofreces?</label>
                                        <span className="text-xs font-semibold text-gray-500">{formData.services.length}/5 seleccionados</span>
                                    </div>
                                    <div className="relative border-2 border-gray-200 rounded-xl flex flex-col mt-2">
                                        <div className="relative border-b border-gray-200 p-2">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                            <input
                                                type="text"
                                                placeholder="Buscar plomero, limpieza..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full pl-8 pr-2 py-1 text-sm outline-none bg-transparent"
                                            />
                                        </div>
                                        <div className="max-h-60 overflow-y-auto flex flex-col divide-y divide-gray-100">
                                            {servicesCatalog
                                                .filter((service) => service.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                                .sort((a, b) => {
                                                    if (a.slug === 'lohaggo-ya' && b.slug !== 'lohaggo-ya') return -1
                                                    if (b.slug === 'lohaggo-ya' && a.slug !== 'lohaggo-ya') return 1
                                                    return 0
                                                })
                                                .map(service => {
                                                    const isFeatured = service.slug === 'lohaggo-ya'
                                                    const selected = formData.services.includes(service.slug)
                                                    const isDisabled = !selected && formData.services.length >= 5
                                                    return (
                                                        <button
                                                            type="button"
                                                            key={service.id}
                                                            disabled={isDisabled}
                                                            className={`w-full flex items-center justify-between px-4 py-3 text-left transition ${selected
                                                                ? (isFeatured ? 'bg-yellow-50 text-yellow-900 border-x-4 border-yellow-400 font-semibold' : 'bg-primary-50/50 text-primary-700 font-semibold border-l-4 border-primary-500')
                                                                : isDisabled
                                                                    ? 'bg-gray-50 opacity-50 cursor-not-allowed'
                                                                    : isFeatured
                                                                        ? 'bg-gradient-to-r from-yellow-50 to-orange-50 hover:from-yellow-100 hover:to-orange-100 text-yellow-900'
                                                                        : 'hover:bg-gray-50 text-gray-700'
                                                                }`}
                                                            onClick={() => toggleService(service.slug)}
                                                        >
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    {isFeatured && <span className="text-base flex-shrink-0 leading-none pb-0.5">🛵</span>}
                                                                    <p className="text-sm font-medium">{isFeatured ? 'LoHaggo Ya Favor' : service.name}</p>
                                                                    {isFeatured && <span className="bg-yellow-400 text-yellow-900 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full tracking-wide flex-shrink-0">Destacado</span>}
                                                                </div>
                                                                {service.basePrice && (
                                                                    <p className="text-xs text-gray-500 mt-1">
                                                                        Desde {formatCurrency(service.basePrice)}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <span
                                                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full border-2 transition flex-shrink-0 ${selected
                                                                    ? (isFeatured ? 'border-yellow-500 bg-yellow-500 text-white' : 'border-primary-500 bg-primary-500 text-white')
                                                                    : 'border-gray-300 text-transparent bg-white shadow-inner'
                                                                    }`}
                                                            >
                                                                {selected && <Check size={14} className="text-white" />}
                                                            </span>
                                                        </button>
                                                    )
                                                })}
                                        </div>
                                    </div>
                                    {servicesError && <p className="text-xs text-red-600 font-semibold">{servicesError}</p>}
                                </div>
                            </div>

                            <div className="mt-8 flex gap-3">
                                <button type="button" onClick={() => setStep(1)} className="px-5 py-3.5 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition">Atrás</button>
                                <button type="button" onClick={nextStep} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all text-center">
                                    Guardar y Continuar
                                </button>
                            </div>
                        </div>

                        {/* ------------ PASO 3 : Creación de Cuenta ------------ */}
                        <div className={`transition-all duration-300 ${step === 3 ? 'opacity-100 translate-x-0 block' : 'opacity-0 translate-x-10 hidden'}`}>
                            <div className="space-y-4">
                                {error && (
                                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-gray-700">Tu correo electrónico</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <input
                                            type="email"
                                            className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition font-medium text-gray-800"
                                            placeholder="tu@email.com"
                                            value={formData.email}
                                            onChange={(e) => handleFieldChange('email', e.target.value)}
                                            onBlur={() => handleFieldBlur('email')}
                                        />
                                    </div>
                                    {fieldErrors.email && touched.email && <p className="text-xs text-red-600 font-semibold">{fieldErrors.email}</p>}
                                </div>

                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-gray-700">Crea una contraseña</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition font-medium text-gray-800"
                                            placeholder="Mínimo 8 caracteres"
                                            value={formData.password}
                                            onChange={(e) => handleFieldChange('password', e.target.value)}
                                            onBlur={() => handleFieldBlur('password')}
                                        />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                    {fieldErrors.password && touched.password && <p className="text-xs text-red-600 font-semibold">{fieldErrors.password}</p>}
                                </div>

                                <div className="pt-2">
                                    <label className="flex items-start gap-3 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={acceptedTerms}
                                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                                            className="mt-1 w-5 h-5 border-2 border-gray-300 rounded focus:ring-primary-500 text-primary-600 cursor-pointer"
                                        />
                                        <span className="text-xs text-gray-600">
                                            Acepto los <Link href="/terms" target="_blank" className="font-bold text-primary-600">Términos</Link> y la <Link href="/privacy" target="_blank" className="font-bold text-primary-600">Política de Privacidad</Link>.
                                        </span>
                                    </label>
                                </div>

                                <input type="text" className="hidden" aria-hidden="true" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />

                                {isBotProtectionEnabled && (
                                    <div className="pt-2">
                                        <TurnstileWidget siteKey={turnstileSiteKey} action="register_unete" onTokenChange={setCaptchaToken} />
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 flex gap-3">
                                <button type="button" onClick={() => setStep(2)} className="px-5 py-3.5 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition">Atrás</button>
                                <button type="submit" disabled={loading} className="flex-1 bg-secondary-500 hover:bg-secondary-600 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                                    {loading ? 'Procesando...' : 'Comenzar a ganar dinero'}
                                </button>
                            </div>
                        </div>

                    </form>
                </div>
            </div>

            {/* Modal de Éxito */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-sm p-8 text-center shadow-2xl">
                        <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                            <Check className="text-green-500 w-10 h-10 stroke-[3]" />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-3">¡Registro Exitoso!</h3>
                        <p className="text-gray-600 mb-8 font-medium leading-relaxed">
                            Tu cuenta se creó correctamente. Recuerda ir a tu perfil y <span className="font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded">subir tus documentos</span> para verificarte y activar tu cuenta.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                window.location.href = '/'
                            }}
                            className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary-500/20 flex items-center justify-center gap-2"
                        >
                            Entendido, comenzar <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function UneteClient() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50 relative z-[100]" />}>
            <SqueezeForm />
        </Suspense>
    )
}

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
    const [showSuccessModal, setShowSuccessModal] = useState(false)
    const [generatedPassword, setGeneratedPassword] = useState('')
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
        setTouched({ ...touched, name: true, phone: true, email: true })
        const errorN = validateName(formData.name)
        const errorP = validatePhone(formData.phone)
        const errorE = validateEmail(formData.email)
        setFieldErrors({ ...fieldErrors, name: errorN, phone: errorP, email: errorE })

        if (errorN || errorP || errorE) {
            scrollToTopError()
            return
        }
        if (honeypot.trim()) return
        if (isBotProtectionEnabled && !captchaToken) {
            setError('Completa la verificación anti-bot.')
            scrollToTopError()
            return
        }

        setLoading(true)

        // Generar contraseña fácil: Nombre + 4 números + *
        const firstName = formData.name.split(' ')[0].replace(/[^a-zA-Z]/g, '').toLowerCase() || 'socio'
        const randomNum = Math.floor(1000 + Math.random() * 9000)
        const autoPassword = `${firstName.charAt(0).toUpperCase() + firstName.slice(1)}${randomNum}*`
        setGeneratedPassword(autoPassword)

        try {
            const payload = { ...formData, password: autoPassword, captchaToken, honeypot, formStartedAt }
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Error al registrar')

            const result = await signIn('credentials', {
                email: formData.email,
                password: autoPassword,
                redirect: false,
            })

            if (result?.error) {
                throw new Error('Registro exitoso pero error al iniciar sesión')
            } else {
                localStorage.setItem('pwa-onboarding-force', '1')
                trackPwaEvent({
                    eventName: PWA_EVENTS.SIGNUP_COMPLETED,
                    role: 'PARTNER',
                    source: 'unete_ads_landing',
                })
                try {
                    if (typeof window !== 'undefined' && window.fbq) {
                        window.fbq('track', 'CompleteRegistration', { value: 0, currency: 'COP' })
                    }
                    // Fallback robusto a prueba de bloqueadores de JavaScript
                    const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || '961436919897711'
                    if (pixelId) {
                        const img = new Image()
                        img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=CompleteRegistration&cd[value]=0&cd[currency]=COP&noscript=1`
                    }
                    console.log('Pixel: Disparado CompleteRegistration (Incluye modo imagen)')
                } catch (e) {
                    console.error('Error enviando pixel', e)
                }
                setLoading(false)
                setShowSuccessModal(true)
            }
        } catch (err: any) {
            setError(err.message || 'Error al registrar')
            setLoading(false)
            setTimeout(() => {
                const container = document.getElementById('unete-container')
                if (container) container.scrollTo({ top: 0, behavior: 'smooth' })
            }, 10)
        }
    }

    const scrollToTopError = () => {
        setTimeout(() => {
            const container = document.getElementById('unete-container')
            if (container) container.scrollTo({ top: 0, behavior: 'smooth' })
        }, 10)
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
                        <span className="text-2xl font-black tracking-tight text-white">LoHaggo</span>
                    </Link>

                    <div className="mt-12 space-y-6">
                        <h1 className="text-2xl leading-snug md:text-5xl font-extrabold md:leading-tight">
                            Aumenta tus ingresos arreglando y solucionando lo que sabes.
                        </h1>
                        <p className="text-white/80 text-lg md:text-xl font-medium">
                            Conviértete en socio de la plataforma líder y recibe clientes en tu ciudad cada día. Sin jefes, maneja tu propio tiempo y aumenta tus ingresos.
                        </p>

                        <div className="mt-8 bg-white/10 p-5 rounded-2xl border border-white/20 backdrop-blur-sm shadow-xl md:mr-8">
                            <h3 className="text-base sm:text-lg font-black text-white mb-4 flex flex-wrap items-center gap-2 leading-tight">
                                Más de <span className="bg-yellow-400 text-yellow-900 text-xs sm:text-sm px-2 py-0.5 rounded-full inline-block">100+</span> servicios disponibles:
                            </h3>
                            <div className="flex flex-wrap gap-2.5">
                                <span className="bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-md text-white text-xs sm:text-sm font-bold px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5 shadow-sm">
                                    🚰 Plomería
                                </span>
                                <span className="bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-md text-white text-xs sm:text-sm font-bold px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5 shadow-sm">
                                    ⚡ Electricistas
                                </span>
                                <span className="bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-md text-white text-xs sm:text-sm font-bold px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5 shadow-sm">
                                    🪚 Carpintería
                                </span>
                                <span className="bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-md text-white text-xs sm:text-sm font-bold px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5 shadow-sm">
                                    🧹 Aseo y Limpieza
                                </span>
                                <span className="bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-md text-white text-xs sm:text-sm font-bold px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5 shadow-sm">
                                    🛵 Mensajeros
                                </span>
                                <span className="bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-md text-white text-xs sm:text-sm font-bold px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5 shadow-sm">
                                    🔧 Reparaciones
                                </span>
                                <span className="text-yellow-300 text-xs sm:text-sm font-black px-1 py-1.5 flex items-center drop-shadow-md">
                                    y decenas más...
                                </span>
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
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-2xl font-black text-gray-900">Activa tu perfil profesional</h2>
                            <span className="text-sm font-bold text-primary-500 bg-primary-50 px-3 py-1 rounded-full">100% Gratis</span>
                        </div>
                        <p className="text-sm text-gray-600 font-medium">Déjanos tus datos para conectar con cientos de clientes en tu ciudad que buscan tus servicios.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5 relative">
                        {error && (
                            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
                                {error}
                            </div>
                        )}
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

                            <input type="text" className="hidden" aria-hidden="true" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />

                            {isBotProtectionEnabled && (
                                <div className="pt-2">
                                    <TurnstileWidget siteKey={turnstileSiteKey} action="register_unete" onTokenChange={setCaptchaToken} />
                                </div>
                            )}
                        </div>

                        <button type="submit" disabled={loading} className="mt-8 w-full bg-secondary-500 hover:bg-secondary-600 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                            {loading ? 'Procesando...' : 'Quiero recibir clientes'} <ArrowRight size={18} />
                        </button>
                    </form>
                </div>
            </div>

            {/* Modal de Éxito */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-md p-8 text-center shadow-2xl">
                        <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                            <Check className="text-green-500 w-8 h-8 stroke-[3]" />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-2">¡Registro Exitoso!</h3>
                        
                        <p className="text-gray-600 mb-4 font-medium leading-relaxed">
                            Cuenta creada. Usa esta contraseña para iniciar sesión o cámbiala en tu perfil:
                        </p>
                        
                        <div className="bg-slate-100 border-2 border-slate-200 rounded-xl p-4 mb-5 flex justify-center">
                            <div className="text-center">
                                <span className="text-xs font-bold text-slate-500 block mb-1">TU CONTRASEÑA ES</span>
                                <span className="text-3xl font-black text-slate-800 tracking-wider font-mono">{generatedPassword}</span>
                            </div>
                        </div>

                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 text-sm text-yellow-800 font-medium text-left">
                            <strong>⚠️ Próximos pasos en tu Perfil:</strong>
                            <ul className="list-disc pl-5 mt-1 space-y-1">
                                <li>Selecciona los <strong>servicios que ofreces</strong>.</li>
                                <li>Sube tus <strong>documentos de verificación</strong>.</li>
                            </ul>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                window.location.href = '/'
                            }}
                            className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary-500/20 flex items-center justify-center gap-2"
                        >
                            Entrar a mi cuenta <ArrowRight size={18} />
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

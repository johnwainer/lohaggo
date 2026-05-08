'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    Mail,
    Phone,
    User,
    Check,
    ArrowRight,
    Sparkles,
    Eye,
    EyeOff,
    DollarSign,
    Clock,
    Shield,
    Star,
    ChevronDown,
    ChevronUp,
    Share2,
    Copy,
    CalendarClock,
} from 'lucide-react'
import { useCity } from '@/lib/city-context'
import TurnstileWidget from '@/components/security/TurnstileWidget'
import { trackPwaEvent } from '@/lib/pwa/telemetry-client'
import { PWA_EVENTS } from '@/lib/pwa/events'

// ─── How it works steps ────────────────────────────────────────────────────
const HOW_IT_WORKS = [
    { num: '1', icon: '📋', title: 'Deja tus datos', desc: 'Llena el formulario en 30 segundos, es gratis.' },
    { num: '2', icon: '💬', title: 'Activa tu perfil', desc: 'Completa tu perfil: sube tus documentos y servicios en minutos.' },
    { num: '3', icon: '📲', title: 'Recibe solicitudes', desc: 'Clientes en tu ciudad te encuentran y solicitan tu servicio.' },
    { num: '4', icon: '💰', title: 'Cobra seguro', desc: 'Recibes el pago protegido por LoHaggo, sin riesgo de estafa.' },
]

// ─── Testimonials ────────────────────────────────────────────────────────
const TESTIMONIALS = [
    {
        initials: 'CR',
        name: 'Carlos R.',
        trade: 'Electricista',
        city: 'Medellín',
        quote: 'Antes buscaba clientes en grupos de Facebook. Con LoHaggo me llegaron 4 trabajos la primera semana.',
    },
    {
        initials: 'MA',
        name: 'María A.',
        trade: 'Limpieza',
        city: 'Medellín',
        quote: 'Nunca pensé que conseguir trabajo fuera tan fácil. Mi horario es mío y cobro directo.',
    },
    {
        initials: 'JP',
        name: 'Juan P.',
        trade: 'Plomero',
        city: 'Medellín',
        quote: 'El pago llega seguro, sin preocupaciones. LoHaggo me da confianza para crecer.',
    },
]

// ─── FAQ ─────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
    {
        q: '¿Cuánto cobra LoHaggo por cada trabajo?',
        a: 'LoHaggo retiene un porcentaje de servicio por cada trabajo completado. Consulta los detalles completos en tu perfil al activarlo.',
    },
    {
        q: '¿Cuándo y cómo me pagan?',
        a: 'El pago se procesa de forma segura dentro de la plataforma y se transfiere a tu cuenta una vez el cliente confirma el servicio.',
    },
    {
        q: '¿Necesito experiencia formal o certificados?',
        a: 'No necesitas título universitario. Solo tener el oficio, ganas de trabajar y pasar nuestra verificación básica de identidad.',
    },
    {
        q: '¿Puedo trabajar en mi tiempo libre o tiene que ser tiempo completo?',
        a: 'Tú defines tu horario. Puedes recibir trabajos los fines de semana, entre semana o cuando quieras. Sin jefes.',
    },
    {
        q: '¿En qué ciudades opera LoHaggo?',
        a: 'Actualmente operamos en Medellín y estamos expandiéndonos. Si estás en otra ciudad, déjanos tus datos y te avisamos cuando lleguemos.',
    },
]

const SERVICES_PAGE_SIZE = 10

// ─── Steps section ───────────────────────────────────────────────────────
function HowItWorksSection({ className = '' }: { className?: string }) {
    return (
        <div className={`bg-white py-10 px-6 md:px-10 ${className}`}>
            <h2 className="text-xl font-black text-gray-900 mb-6 text-center">¿Cómo funciona?</h2>
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                {HOW_IT_WORKS.map((step) => (
                    <div key={step.num} className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-black text-sm">
                            {step.num}
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-lg">{step.icon}</span>
                                <span className="font-bold text-gray-900 text-sm">{step.title}</span>
                            </div>
                            <p className="text-xs text-gray-500">{step.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─── FAQ accordion ───────────────────────────────────────────────────────
function FAQSection() {
    const [openIndex, setOpenIndex] = useState<number | null>(null)
    return (
        <div className="bg-gray-50 py-12 px-6 md:px-10">
            <h2 className="text-xl font-black text-gray-900 mb-6 text-center">Preguntas frecuentes</h2>
            <div className="space-y-3 max-w-2xl mx-auto">
                {FAQ_ITEMS.map((item, i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <button
                            className="w-full flex items-center justify-between px-5 py-4 text-left font-bold text-gray-900 text-sm hover:bg-gray-50 transition"
                            onClick={() => setOpenIndex(openIndex === i ? null : i)}
                        >
                            <span>{item.q}</span>
                            {openIndex === i ? <ChevronUp size={18} className="flex-shrink-0 text-primary-500" /> : <ChevronDown size={18} className="flex-shrink-0 text-gray-400" />}
                        </button>
                        {openIndex === i && (
                            <div className="px-5 pb-4 text-sm text-gray-600 border-t border-gray-100 pt-3">
                                {item.a}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─── Testimonials section ────────────────────────────────────────────────
function TestimonialsSection() {
    return (
        <div className="bg-white py-12 px-6 md:px-10">
            <h2 className="text-xl font-black text-gray-900 mb-6 text-center">Lo que dicen nuestros socios</h2>
            {/* Mobile: 1 column stacked; Desktop: 3 columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {TESTIMONIALS.map((t) => (
                    <div
                        key={t.name}
                        className="bg-white border border-gray-200 rounded-xl shadow-sm p-5"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                                {t.initials}
                            </div>
                            <div>
                                <div className="font-bold text-gray-900 text-sm">{t.name}</div>
                                <div className="text-xs text-gray-500">{t.trade} · {t.city}</div>
                            </div>
                        </div>
                        <div className="flex mb-2">
                            {[...Array(5)].map((_, i) => <Star key={i} size={12} className="text-yellow-400 fill-yellow-400" />)}
                        </div>
                        <p className="text-sm text-gray-700 italic">"{t.quote}"</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─── Main form ───────────────────────────────────────────────────────────
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
        oficio: [] as string[],
    })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [showSuccessModal, setShowSuccessModal] = useState(false)
    const [generatedPassword, setGeneratedPassword] = useState('')
    const [linkCopied, setLinkCopied] = useState(false)
    const [captchaToken, setCaptchaToken] = useState('')
    const [honeypot, setHoneypot] = useState('')
    const [formStartedAt] = useState(() => Date.now().toString())

    const [fieldErrors, setFieldErrors] = useState({ name: '', email: '', phone: '' })
    const [touched, setTouched] = useState({ name: false, email: false, phone: false })
    const [leadFired, setLeadFired] = useState(false)
    const [allServices, setAllServices] = useState<string[]>([])
    const [servicesPage, setServicesPage] = useState(0)

    const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''
    const isBotProtectionEnabled = Boolean(turnstileSiteKey)

    // ── Cargar servicios de la DB ─────────────────────────────────────────
    useEffect(() => {
        fetch('/api/public/services')
            .then((r) => r.json())
            .then((data: { id: string; name: string }[]) => {
                setAllServices(data.map((s) => s.name))
            })
            .catch(() => {})
    }, [])

    // ── Pixel: ViewContent al cargar + captura de UTM ─────────────────────
    useEffect(() => {
        // Disparar ViewContent para que Meta sepa quién llega a la landing
        try {
            if (typeof window !== 'undefined' && window.fbq) {
                window.fbq('track', 'ViewContent', {
                    content_name: 'Unete Socio Landing',
                    content_category: 'Partner Registration',
                })
            }
        } catch (e) { /* silent */ }

        // Guardar UTM params en sessionStorage para enviarlos al registrar
        const params = new URLSearchParams(window.location.search)
        const utmData: Record<string, string> = {}
        ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'].forEach((key) => {
            const val = params.get(key)
            if (val) utmData[key] = val
        })
        if (Object.keys(utmData).length > 0) {
            sessionStorage.setItem('unete_utm', JSON.stringify(utmData))
        }
    }, [])

    // ── Pixel: Lead cuando el usuario toca el primer campo ────────────────
    const fireLeadEvent = () => {
        if (leadFired) return
        setLeadFired(true)
        try {
            if (typeof window !== 'undefined' && window.fbq) {
                window.fbq('track', 'Lead', { content_name: 'Unete Form Start' })
            }
        } catch (e) { /* silent */ }
    }

    useEffect(() => {
        const hideGlobalElements = () => {
            document.querySelectorAll('nav, footer').forEach((el) => {
                if (el instanceof HTMLElement) el.style.display = 'none'
            })
            document.querySelectorAll('div[class*="fixed bottom-0 z-40"]').forEach((el) => {
                if (el instanceof HTMLElement) el.style.display = 'none'
            })
        }
        hideGlobalElements()
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

    const validateName = (v: string) => (!v ? 'El nombre es obligatorio' : v.length < 2 ? 'Debe tener al menos 2 caracteres' : '')
    const validateEmail = (v: string) => (!v ? 'El correo es obligatorio' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Correo inválido' : '')
    const validatePhone = (v: string) => {
        if (!v) return 'El teléfono es obligatorio'
        const clean = v.replace(/\s/g, '')
        if (!/^[0-9]{10}$/.test(clean)) return 'El teléfono debe tener 10 dígitos'
        if (!clean.startsWith('3')) return 'Debe comenzar con 3 (formato colombiano)'
        return ''
    }

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
        }
        setFieldErrors((prev) => ({ ...prev, [field]: errorMap[field] }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setTouched({ name: true, phone: true, email: true })
        const errorN = validateName(formData.name)
        const errorP = validatePhone(formData.phone)
        const errorE = validateEmail(formData.email)
        setFieldErrors({ name: errorN, phone: errorP, email: errorE })

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

        const firstName = formData.name.split(' ')[0].replace(/[^a-zA-Z]/g, '').toLowerCase() || 'socio'
        const randomNum = Math.floor(1000 + Math.random() * 9000)
        const autoPassword = `${firstName.charAt(0).toUpperCase() + firstName.slice(1)}${randomNum}*`
        setGeneratedPassword(autoPassword)

        try {
            const savedUtm = sessionStorage.getItem('unete_utm')
            const utmData = savedUtm ? JSON.parse(savedUtm) : {}
            const payload = { ...formData, password: autoPassword, captchaToken, honeypot, formStartedAt, ...utmData }
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
                } catch (e) {
                    console.error('Error enviando pixel', e)
                }
                setLoading(false)
                setShowSuccessModal(true)
            }
        } catch (err: any) {
            setError(err.message || 'Error al registrar')
            setLoading(false)
            scrollToTopError()
        }
    }

    const scrollToTopError = () => {
        setTimeout(() => {
            const container = document.getElementById('unete-container')
            if (container) container.scrollTo({ top: 0, behavior: 'smooth' })
        }, 10)
    }

    // ── Floating CTA visibility (hides when form is in viewport) ──────────
    const [showFloatingCta, setShowFloatingCta] = useState(true)
    const formSectionRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = formSectionRef.current
        if (!el) return
        const observer = new IntersectionObserver(
            ([entry]) => setShowFloatingCta(!entry.isIntersecting),
            { threshold: 0.3 }
        )
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    const scrollToForm = () => {
        const container = document.getElementById('unete-container')
        const form = formSectionRef.current
        if (container && form) {
            container.scrollTo({ top: form.offsetTop - 16, behavior: 'smooth' })
        }
    }

    return (
        <div id="unete-container" className="min-h-screen bg-slate-50 absolute inset-0 z-[100] overflow-y-auto">

            {/* ── Two-column section ─────────────────────────────────── */}
            <div className="flex flex-col md:flex-row">

                {/* ── Left column: Hero ─────────────────────────────── */}
                <div className="w-full md:w-[55%] bg-gradient-to-br from-primary-600 via-primary-500 to-secondary-500 text-white flex flex-col">
                    <div className="p-8 md:p-12 flex flex-col flex-1">
                        {/* Logo sin link — landing de conversión, sin distracciones */}
                        <div className="inline-flex items-center space-x-2">
                            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                                <Sparkles className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-2xl font-black tracking-tight text-white">LoHaggo</span>
                        </div>

                        <div className="mt-10 space-y-6">
                            <h1 className="text-xl min-[400px]:text-2xl leading-snug md:text-5xl font-extrabold md:leading-tight break-words overflow-hidden">
                                Aumenta tus ingresos arreglando y solucionando lo que sabes.
                            </h1>
                            {/* Cobertura actual — no invasivo */}
                            <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 backdrop-blur-sm px-3 py-1.5 rounded-full">
                                <span className="text-base leading-none">📍</span>
                                <span className="text-white font-semibold text-sm">Medellín y Área Metropolitana</span>
                                <span className="bg-green-400/30 text-green-200 text-xs font-bold px-2 py-0.5 rounded-full border border-green-300/30">Lanzamiento Jul 2026</span>
                            </div>
                            <p className="text-white/80 text-lg md:text-xl font-medium">
                                Conviértete en socio de la plataforma líder y recibe clientes en tu ciudad cada día. Sin jefes, maneja tu propio tiempo y aumenta tus ingresos.
                            </p>

                            <div className="bg-white/10 p-5 rounded-2xl border border-white/20 backdrop-blur-sm shadow-xl md:mr-8">
                                <h3 className="text-base sm:text-lg font-black text-white mb-4 flex flex-wrap items-center gap-2 leading-tight">
                                    Más de <span className="bg-yellow-400 text-yellow-900 text-xs sm:text-sm px-2 py-0.5 rounded-full inline-block">100+</span> servicios disponibles:
                                </h3>
                                <div className="flex flex-wrap gap-2.5">
                                    {['🚰 Plomería', '⚡ Electricistas', '🪚 Carpintería', '🧹 Aseo y Limpieza', '🛵 Mensajeros', '🔧 Reparaciones'].map((s) => (
                                        <span key={s} className="bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-md text-white text-xs sm:text-sm font-bold px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5 shadow-sm">
                                            {s}
                                        </span>
                                    ))}
                                    <span className="text-yellow-300 text-xs sm:text-sm font-black px-1 py-1.5 flex items-center drop-shadow-md">y decenas más...</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 space-y-3">
                            {[
                                { icon: <DollarSign size={18} />, text: 'Decide cuánto ganas. Cero suscripciones para entrar.' },
                                { icon: <Clock size={18} />, text: 'Tú controlas tu tiempo. Sin jefes.' },
                                { icon: <Shield size={18} />, text: 'Soporte y pagos protegidos por LoHaggo.' },
                            ].map(({ icon, text }) => (
                                <div key={text} className="flex items-center gap-3 bg-white/10 border border-white/20 rounded-xl px-4 py-3">
                                    <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-white">
                                        {icon}
                                    </div>
                                    <span className="text-white font-semibold text-sm">{text}</span>
                                </div>
                            ))}
                        </div>

                        {/* CTA secundario — para usuarios ya convencidos */}
                        <button
                            onClick={scrollToForm}
                            className="mt-6 inline-flex items-center gap-2 bg-white text-primary-700 font-black px-6 py-3 rounded-xl shadow-lg hover:bg-gray-50 transition-all text-sm md:text-base"
                        >
                            Registrarme ahora <ArrowRight size={16} />
                        </button>

                        {/* Social proof */}
                        <div className="mt-10 pt-8 border-t border-white/20">
                            <div className="flex items-center gap-4">
                                <div className="flex -space-x-3">
                                    <div className="w-10 h-10 rounded-full border-2 border-primary-500 bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-800 shadow-sm">CR</div>
                                    <div className="w-10 h-10 rounded-full border-2 border-primary-500 bg-slate-300 flex items-center justify-center font-bold text-xs text-slate-800 shadow-sm">MA</div>
                                    <div className="w-10 h-10 rounded-full border-2 border-primary-500 bg-secondary-400 flex items-center justify-center font-bold text-xs text-white shadow-sm">+500</div>
                                </div>
                                <div className="text-sm">
                                    <div className="flex text-yellow-300">
                                        {[...Array(5)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
                                    </div>
                                    <span className="font-semibold text-white/90">Socios activos hoy</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Steps — single instance, always visible, in left col */}
                    <HowItWorksSection />
                </div>

                {/* ── Right column: Form ────────────────────────────── */}
                <div ref={formSectionRef} className="w-full md:w-[45%] bg-slate-50 md:sticky md:top-0 md:h-screen md:overflow-y-auto flex flex-col justify-center p-6 md:p-10">

                    <div className="max-w-md w-full mx-auto animate-fade-in">
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-2xl font-black text-gray-900">Activa tu perfil profesional</h2>
                                <span className="text-sm font-bold text-primary-500 bg-primary-50 px-3 py-1 rounded-full">100% Gratis</span>
                            </div>
                            <p className="text-sm text-gray-600 font-medium">Déjanos tus datos para conectar con cientos de clientes en <span className="font-semibold text-gray-800">Medellín y el Área Metropolitana</span> que buscan tus servicios.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4 relative">
                            {error && (
                                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
                                    {error}
                                </div>
                            )}

                            {/* Name */}
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
                                        onFocus={fireLeadEvent}
                                    />
                                </div>
                                {fieldErrors.name && touched.name && <p className="text-xs text-red-600 font-semibold">{fieldErrors.name}</p>}
                            </div>

                            {/* Phone */}
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

                            {/* Oficio — multi-select */}
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-gray-700">
                                    ¿Qué servicios ofreces?{' '}
                                    <span className="text-gray-400 font-normal">(opcional, puedes elegir varios)</span>
                                    {formData.oficio.length > 0 && (
                                        <span className="ml-2 text-primary-600 font-semibold">{formData.oficio.length} seleccionado{formData.oficio.length > 1 ? 's' : ''}</span>
                                    )}
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {servicesPage > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setServicesPage((p) => p - 1)}
                                            className="px-3 py-1.5 rounded-full text-sm font-semibold border-2 border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-all"
                                        >
                                            ← Anteriores
                                        </button>
                                    )}
                                    {allServices
                                        .slice(servicesPage * SERVICES_PAGE_SIZE, (servicesPage + 1) * SERVICES_PAGE_SIZE)
                                        .map((o) => {
                                            const selected = formData.oficio.includes(o)
                                            return (
                                                <button
                                                    key={o}
                                                    type="button"
                                                    onClick={() => setFormData((prev) => ({
                                                        ...prev,
                                                        oficio: selected
                                                            ? prev.oficio.filter((x) => x !== o)
                                                            : [...prev.oficio, o],
                                                    }))}
                                                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all ${
                                                        selected
                                                            ? 'bg-primary-500 border-primary-500 text-white'
                                                            : 'bg-white border-gray-200 text-gray-700 hover:border-primary-300'
                                                    }`}
                                                >
                                                    {o}
                                                </button>
                                            )
                                        })}
                                    {(servicesPage + 1) * SERVICES_PAGE_SIZE < allServices.length && (
                                        <button
                                            type="button"
                                            onClick={() => setServicesPage((p) => p + 1)}
                                            className="px-3 py-1.5 rounded-full text-sm font-semibold border-2 border-dashed border-primary-400 text-primary-600 hover:bg-primary-50 transition-all"
                                        >
                                            Otro →
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Email */}
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

                            {/* Honeypot */}
                            <input type="text" className="hidden" aria-hidden="true" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />

                            <div className="pt-2" style={{ minHeight: isBotProtectionEnabled ? '70px' : 0 }}>
                                {isBotProtectionEnabled && (
                                    <TurnstileWidget siteKey={turnstileSiteKey} action="register" onTokenChange={setCaptchaToken} />
                                )}
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="mt-2 w-full bg-secondary-500 hover:bg-secondary-600 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                                >
                                    {loading ? 'Procesando...' : 'Quiero recibir clientes'} <ArrowRight size={18} />
                                </button>
                                {/* TAREA 3: confirmation text */}
                                <p className="text-center text-xs text-gray-500 mt-2">
                                    ✅ Proceso 100% en línea. Gratis. Sin compromisos.
                                </p>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            {/* ── Full-width sections ────────────────────────────────── */}
            <TestimonialsSection />
            <FAQSection />

            {/* ── Success Modal ──────────────────────────────────────── */}
            {showSuccessModal && (() => {
                const registeredCity = cities.find(c => c.slug === formData.city)
                const launchDate = registeredCity?.launchDate
                const daysUntilLaunch = launchDate
                    ? Math.ceil((new Date(launchDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : null
                const hasFutureLaunch = daysUntilLaunch !== null && daysUntilLaunch > 0
                const launchFormatted = launchDate
                    ? new Date(launchDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
                    : null
                const shareUrl = 'https://www.lohaggo.com/unete'
                const shareMsg = `¡Me acabo de registrar en LoHaggo para recibir clientes! Si eres técnico, plomero, electricista u ofreces servicios del hogar, regístrate gratis aquí: ${shareUrl}`
                const handleCopy = () => {
                    navigator.clipboard.writeText(shareUrl)
                    setLinkCopied(true)
                    setTimeout(() => setLinkCopied(false), 2000)
                }
                return (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                                    <Check className="text-green-500 w-8 h-8 stroke-[3]" />
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 mb-2">¡Registro Exitoso!</h3>
                                <p className="text-gray-600 mb-4 font-medium leading-relaxed">
                                    Te creamos una contraseña automática. Guárdala o cámbiala desde tu perfil:
                                </p>
                                <div className="bg-slate-100 border-2 border-slate-200 rounded-xl p-4 mb-5 flex justify-center">
                                    <div className="text-center">
                                        <span className="text-xs font-bold text-slate-500 block mb-1">TU CONTRASEÑA ES</span>
                                        <span className="text-3xl font-black text-slate-800 tracking-wider font-mono">{generatedPassword}</span>
                                    </div>
                                </div>

                                {/* Banner lanzamiento ciudad */}
                                {hasFutureLaunch ? (
                                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-left">
                                        <div className="flex items-start gap-3">
                                            <CalendarClock className="text-blue-500 w-6 h-6 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-blue-800 font-black text-sm">¡{registeredCity?.name} lanza el {launchFormatted}!</p>
                                                <p className="text-blue-600 text-xs mt-1 leading-relaxed">
                                                    Tienes <strong>{daysUntilLaunch} días</strong> para prepararte. Sube tus documentos y completa tu perfil para estar listo desde el primer día.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-4 text-center">
                                        <p className="text-primary-700 font-black text-base">🚀 Próximamente estarás disponible</p>
                                        <p className="text-primary-600 text-sm mt-1">Tu perfil estará visible para los clientes una vez que verifiquemos tu cuenta.</p>
                                    </div>
                                )}

                                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-5 text-sm text-yellow-800 font-medium text-left">
                                    <strong>⚠️ {hasFutureLaunch ? 'Prepárate para el lanzamiento:' : 'Próximos pasos en tu Perfil:'}</strong>
                                    <ul className="list-disc pl-5 mt-1 space-y-1">
                                        <li>Selecciona los <strong>servicios que ofreces</strong>.</li>
                                        <li>Sube tus <strong>documentos de verificación</strong>.</li>
                                        {hasFutureLaunch && <li>Completa tu <strong>foto de perfil</strong> para generar confianza.</li>}
                                    </ul>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => { window.location.href = '/partner/verification' }}
                                    className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary-500/20 flex items-center justify-center gap-2 mb-5"
                                >
                                    Verificar mis documentos <ArrowRight size={18} />
                                </button>

                                {/* Referral — no invasivo */}
                                <div className="border-t border-gray-100 pt-5">
                                    <p className="text-sm font-semibold text-gray-700 flex items-center justify-center gap-2 mb-1">
                                        <Share2 size={15} className="text-secondary-500" />
                                        ¿Tienes amigos que ofrecen servicios?
                                    </p>
                                    <p className="text-xs text-gray-500 mb-3">Invítalos — entre más socios, más trabajo para todos.</p>
                                    <div className="flex gap-2">
                                        <a
                                            href={`https://wa.me/?text=${encodeURIComponent(shareMsg)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20c05c] text-white font-bold py-2.5 rounded-xl text-sm transition-all"
                                        >
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                            WhatsApp
                                        </a>
                                        <button
                                            onClick={handleCopy}
                                            className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-sm transition-all"
                                        >
                                            <Copy size={14} />
                                            {linkCopied ? '¡Copiado!' : 'Copiar link'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })()}

            {/* ── Link para clientes al final de la página ───────────── */}
            <div className="bg-gray-900 py-4 text-center">
                <Link href="/servicios" className="text-gray-400 hover:text-white text-sm transition-colors">
                    ¿Eres cliente? Ver servicios disponibles →
                </Link>
            </div>

            {/* ── Floating CTA — mobile only, oculto cuando el form está visible ── */}
            {showFloatingCta && !showSuccessModal && (
                <div className="fixed bottom-0 left-0 right-0 z-[150] md:hidden px-4 pb-4 pt-6 bg-gradient-to-t from-slate-900/70 to-transparent pointer-events-none">
                    <button
                        onClick={scrollToForm}
                        className="pointer-events-auto w-full bg-secondary-500 hover:bg-secondary-600 active:bg-secondary-700 text-white font-black py-4 rounded-xl shadow-2xl flex items-center justify-center gap-2 text-base"
                    >
                        Quiero recibir clientes <ArrowRight size={18} />
                    </button>
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

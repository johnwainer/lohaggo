'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, User, Phone, Mail, MapPin, Calendar, Star, Shield,
  CreditCard, FileText, MessageSquare, AlertTriangle, Package,
  Wallet, CheckCircle, XCircle, Clock, ExternalLink, Tag,
  Building2, Camera, Award, Key, Eye, EyeOff, ToggleLeft, ToggleRight,
  Link2, Copy, Check, X
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string
  name: string
  email: string
  phone: string | null
  image: string | null
  role: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  clientRating: number
  clientTotalReviews: number
  completedServicesCount: number
  notificationsPushEnabled: boolean
  notificationsEmailEnabled: boolean
  notificationsWhatsappEnabled: boolean
  notificationsSmsEnabled: boolean
  mercadopagoCustomerId: string | null
  addresses: Address[]
  bookings: Booking[]
  payments: Payment[]
  conversations: Conversation[]
  messagingOptOuts: OptOut[]
  supportCases: SupportCase[]
  fraudSignals: FraudSignal[]
  magicTokens: MagicToken[]
  partnerProfile: PartnerProfile | null
  _count: { bookings: number; payments: number; serviceRequests: number; conversations: number; supportCases: number }
}

interface Address {
  id: string; label: string | null; street: string; number: string; complement: string | null
  neighborhood: string; city: string; postalCode: string; instructions: string | null
  isPrimary: boolean; isActive: boolean
}

interface Booking {
  id: string; status: string; totalPrice: number; scheduledDate: string; scheduledTime: string
  address: string; city: string; notes: string | null; createdAt: string
  clientCommissionRate: number | null; partnerCommissionRate: number | null
  service: { id: string; name: string }
  partner: { id: string; user: { id: string; name: string; email: string } } | null
  payment: { id: string; status: string; totalAmount: number; paidAt: string | null; paymentMethodType: string | null; mercadopagoId: string | null } | null
  review: { clientToPartnerRating: number | null; clientToPartnerComment: string | null; partnerToClientRating: number | null; partnerToClientComment: string | null; clientReviewedAt: string | null } | null
}

interface Payment {
  id: string; amount: number; totalAmount: number; status: string; paymentMethodType: string | null
  paidAt: string | null; createdAt: string; mercadopagoId: string | null
  booking: { id: string; service: { name: string } } | null
}

interface InternalNote {
  id: string; body: string; sentAt: string
  sentBy: { id: string; name: string } | null
}

interface Conversation {
  id: string; channel: string; contactPhone: string | null; status: string; tags: string[]
  lastMessageAt: string | null; lastMessageBody: string | null; unreadCount: number; createdAt: string
  _count: { messages: number }
  messages: InternalNote[]
}

interface OptOut {
  id: string; channel: string; destination: string; isActive: boolean; createdAt: string
}

interface SupportCase {
  id: string; subject: string; priority: string; status: string; queue: string | null
  createdAt: string; resolvedAt: string | null; resolutionNote: string | null
}

interface FraudSignal {
  id: string; type: string; severity: string; reason: string; details: string | null; status: string; createdAt: string
}

interface MagicToken {
  id: string; redirectUrl: string | null; expiresAt: string; usedAt: string | null; createdAt: string
}

interface PartnerProfile {
  id: string; bio: string | null; rating: number; totalReviews: number; completedServicesCount: number
  isActive: boolean; isAvailable: boolean; verified: boolean; city: string | null; slug: string | null
  profileHeadline: string | null; isPublicProfile: boolean; createdAt: string
  services: PartnerService[]
  documents: PartnerDocument[]
  bankAccounts: BankAccount[]
  bookings: PartnerBooking[]
  payouts: Payout[]
  achievements: Achievement[]
  workPhotos: WorkPhoto[]
}

interface PartnerService {
  id: string; isActive: boolean; isAvailable: boolean; basePrice: number | null; createdAt: string
  service: { id: string; name: string }
  documents: { id: string; type: string; status: string; rejectionReason: string | null; createdAt: string }[]
}

interface PartnerDocument {
  id: string; type: string; documentUrl: string; status: string; rejectionReason: string | null
  reviewedAt: string | null; createdAt: string
}

interface BankAccount {
  id: string; bankName: string; accountType: string; accountNumber: string; accountHolderName: string
  holderDocumentType: string; holderDocumentNumber: string; isDefault: boolean; isActive: boolean
  verifiedAt: string | null; createdAt: string
}

interface PartnerBooking {
  id: string; status: string; totalPrice: number; scheduledDate: string; scheduledTime: string
  city: string; createdAt: string
  service: { id: string; name: string }
  user: { id: string; name: string; email: string }
  payment: { id: string; status: string; totalAmount: number; paidAt: string | null } | null
}

interface Payout {
  id: string; amount: number; netAmount: number; partnerCommission: number; partnerCommissionRate: number
  status: string; processedAt: string | null; createdAt: string
  payment: { booking: { service: { name: string } } } | null
}

interface Achievement {
  id: string; unlockedAt: string
  achievement: { name: string; description: string; icon: string | null }
}

interface WorkPhoto {
  id: string; url: string; caption: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const fmtDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const currency = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const BOOKING_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pendiente', cls: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: 'Confirmado', cls: 'bg-blue-100 text-blue-800' },
  IN_PROGRESS: { label: 'En progreso', cls: 'bg-indigo-100 text-indigo-800' },
  COMPLETED: { label: 'Completado', cls: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelado', cls: 'bg-red-100 text-red-800' },
}

const PAYMENT_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pendiente', cls: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: 'Aprobado', cls: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Rechazado', cls: 'bg-red-100 text-red-800' },
  CANCELLED: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-600' },
  REFUNDED: { label: 'Reembolsado', cls: 'bg-purple-100 text-purple-800' },
}

const PAYOUT_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pendiente', cls: 'bg-yellow-100 text-yellow-800' },
  PROCESSING: { label: 'Procesando', cls: 'bg-blue-100 text-blue-800' },
  COMPLETED: { label: 'Completado', cls: 'bg-green-100 text-green-800' },
  FAILED: { label: 'Fallido', cls: 'bg-red-100 text-red-800' },
  CANCELLED: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-600' },
}

const DOC_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pendiente', cls: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: 'Aprobado', cls: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Rechazado', cls: 'bg-red-100 text-red-800' },
}

const CONV_STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: 'Abierta', cls: 'bg-blue-100 text-blue-800' },
  IN_PROGRESS: { label: 'En progreso', cls: 'bg-indigo-100 text-indigo-800' },
  RESOLVED: { label: 'Resuelta', cls: 'bg-green-100 text-green-800' },
  CLOSED: { label: 'Cerrada', cls: 'bg-gray-100 text-gray-600' },
}

const PRIORITY_CLS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800',
}

const SEVERITY_CLS: Record<string, string> = {
  LOW: 'bg-blue-100 text-blue-700',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
}

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>
}

function Section({ title, children, empty }: { title: string; children?: React.ReactNode; empty?: boolean }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">{title}</h3>
      </div>
      <div className={empty ? 'p-5 text-sm text-gray-400' : 'divide-y divide-gray-50'}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3">
      <span className="text-xs text-gray-500 w-36 flex-shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 text-sm text-gray-800">{children}</div>
    </div>
  )
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'reservas', label: 'Reservas' },
  { id: 'conversaciones', label: 'Conversaciones' },
  { id: 'pagos', label: 'Pagos' },
  { id: 'soporte', label: 'Soporte' },
  { id: 'actividad', label: 'Actividad' },
  { id: 'socio', label: 'Perfil Socio', partnerOnly: true },
]

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('resumen')
  const [togglingActive, setTogglingActive] = useState(false)
  const [showMagicModal, setShowMagicModal] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then(r => r.json())
      .then(d => setUser(d.user))
      .finally(() => setLoading(false))
  }, [id])

  const handleMagicTokenCreated = (token: MagicToken) => {
    setUser(u => u ? { ...u, magicTokens: [token, ...u.magicTokens] } : u)
  }

  const toggleActive = async () => {
    if (!user) return
    setTogglingActive(true)
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !user.isActive }),
    })
    if (res.ok) {
      const d = await res.json()
      setUser(u => u ? { ...u, isActive: d.user.isActive } : u)
    }
    setTogglingActive(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-gray-400">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mr-3" />
        <span className="text-sm font-medium">Cargando perfil…</span>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-400">
        <User size={40} className="mb-3" />
        <p className="font-medium">Usuario no encontrado</p>
      </div>
    )
  }

  const isPartner = !!user.partnerProfile
  const initials = (user.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const visibleTabs = TABS.filter(t => !t.partnerOnly || isPartner)

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.back()}
          className="mt-1 p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
            <Badge
              label={user.role === 'PARTNER' ? 'Socio' : user.role === 'ADMIN' ? 'Admin' : 'Cliente'}
              cls={user.role === 'PARTNER' ? 'bg-purple-100 text-purple-800' : user.role === 'ADMIN' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}
            />
            {!user.isActive && <Badge label="Inactivo" cls="bg-gray-200 text-gray-600" />}
            {isPartner && user.partnerProfile?.verified && (
              <Badge label="Verificado" cls="bg-green-100 text-green-700" />
            )}
          </div>
          <p className="text-gray-500 text-sm mt-0.5">{user.email} · ID: {user.id}</p>
        </div>
        <div className="flex items-center gap-2">
          {isPartner && user.partnerProfile?.slug && (
            <a
              href={`/socios/${user.partnerProfile.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <ExternalLink size={14} /> Ver perfil público
            </a>
          )}
          <button
            onClick={() => setShowMagicModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Link2 size={14} /> Magic Link
          </button>
          <a
            href={`/admin/inbox?contactPhone=${encodeURIComponent(user.phone ?? '')}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <MessageSquare size={14} /> Bandeja
          </a>
          <button
            onClick={toggleActive}
            disabled={togglingActive}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              user.isActive
                ? 'bg-red-50 text-red-700 hover:bg-red-100'
                : 'bg-green-50 text-green-700 hover:bg-green-100'
            }`}
          >
            {user.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            {user.isActive ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>

      {/* Avatar + stats strip */}
      <div className="flex items-center gap-5 p-5 rounded-2xl bg-white border border-gray-200">
        {user.image ? (
          <img src={user.image} alt={user.name} className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 text-white flex items-center justify-center text-xl font-bold flex-shrink-0">
            {initials}
          </div>
        )}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat label="Reservas" value={user._count.bookings} />
          <Stat label="Pagos" value={user._count.payments} />
          <Stat label="Conversaciones" value={user._count.conversations} />
          <Stat label="Casos soporte" value={user._count.supportCases} />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-gray-100 p-1">
        {visibleTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'resumen' && <TabResumen user={user} allTags={Array.from(new Set(user.conversations.flatMap(c => c.tags)))} />}
      {tab === 'reservas' && <TabReservas bookings={user.bookings} isPartner={isPartner} partnerBookings={user.partnerProfile?.bookings} />}
      {tab === 'conversaciones' && <TabConversaciones conversations={user.conversations} />}
      {tab === 'pagos' && <TabPagos payments={user.payments} />}
      {tab === 'soporte' && <TabSoporte cases={user.supportCases} />}
      {tab === 'actividad' && <TabActividad fraudSignals={user.fraudSignals} magicTokens={user.magicTokens} optOuts={user.messagingOptOuts} />}
      {tab === 'socio' && isPartner && <TabSocio profile={user.partnerProfile!} />}

      {showMagicModal && (
        <MagicLinkModal
          userId={user.id}
          userName={user.name}
          isPartner={isPartner}
          onClose={() => setShowMagicModal(false)}
          onCreated={handleMagicTokenCreated}
        />
      )}
    </div>
  )
}

// ── Magic Link Modal ──────────────────────────────────────────────────────────

const REDIRECT_OPTIONS = [
  { value: '/partner/dashboard', label: 'Inicio del socio' },
  { value: '/partner/verification', label: 'Verificación de documentos' },
  { value: '/app', label: 'App del socio' },
  { value: '/dashboard', label: 'Inicio del cliente' },
  { value: '/', label: 'Inicio (homepage)' },
  { value: '__custom__', label: 'URL personalizada…' },
]

function MagicLinkModal({
  userId, userName, isPartner, onClose, onCreated,
}: {
  userId: string
  userName: string
  isPartner: boolean
  onClose: () => void
  onCreated: (token: MagicToken) => void
}) {
  const defaultRedirect = isPartner ? '/partner/dashboard' : '/dashboard'
  const [redirectUrl, setRedirectUrl] = useState(defaultRedirect)
  const [customUrl, setCustomUrl] = useState('')
  const [requirePasswordChange, setRequirePasswordChange] = useState(false)
  const [loading, setLoading] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const finalUrl = redirectUrl === '__custom__' ? customUrl : redirectUrl

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/magic/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: [userId], redirectUrl: finalUrl, requirePasswordChange }),
      })
      const data = await res.json()
      if (!res.ok || !data.tokens?.length) {
        setError(data.error ?? 'Error al generar el enlace')
        return
      }
      const t = data.tokens[0]
      setGeneratedUrl(t.url)
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
      onCreated({ id: t.token, redirectUrl: finalUrl, expiresAt, usedAt: null, createdAt: new Date().toISOString() })
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    if (!generatedUrl) return
    await navigator.clipboard.writeText(generatedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Link2 size={18} className="text-primary-600" />
            <h2 className="font-semibold text-gray-900">Generar Magic Link</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-500">
            Genera un enlace de ingreso único para <span className="font-medium text-gray-800">{userName}</span>. Expira en 72 horas.
          </p>

          {!generatedUrl ? (
            <>
              {/* Redirect URL */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Destino después del login</label>
                <select
                  value={redirectUrl}
                  onChange={e => setRedirectUrl(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                >
                  {REDIRECT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {redirectUrl === '__custom__' && (
                  <input
                    type="text"
                    placeholder="ej. /partner/services"
                    value={customUrl}
                    onChange={e => setCustomUrl(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                )}
              </div>

              {/* Password change */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requirePasswordChange}
                  onChange={e => setRequirePasswordChange(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-300"
                />
                <span className="text-sm text-gray-700">Pedir cambio de contraseña al ingresar</span>
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                onClick={generate}
                disabled={loading || (redirectUrl === '__custom__' && !customUrl.trim())}
                className="w-full py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <Link2 size={15} />
                )}
                {loading ? 'Generando…' : 'Generar enlace'}
              </button>
            </>
          ) : (
            <>
              <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={16} className="text-green-600" />
                  <span className="text-sm font-medium text-green-800">Enlace generado</span>
                </div>
                <p className="text-xs font-mono text-green-700 break-all">{generatedUrl}</p>
              </div>

              <button
                onClick={copy}
                className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  copied
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? '¡Copiado!' : 'Copiar enlace'}
              </button>

              <button
                onClick={() => { setGeneratedUrl(null); setError(null) }}
                className="w-full py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Generar otro
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

// ── Tab: Resumen ──────────────────────────────────────────────────────────────

const TAG_COLORS: Record<string, string> = {
  urgente: 'bg-red-100 text-red-700 border-red-200',
  'pago-pendiente': 'bg-orange-100 text-orange-700 border-orange-200',
  reclamo: 'bg-rose-100 text-rose-700 border-rose-200',
  documentos: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  onboarding: 'bg-purple-100 text-purple-700 border-purple-200',
  seguimiento: 'bg-blue-100 text-blue-700 border-blue-200',
  información: 'bg-gray-100 text-gray-600 border-gray-200',
}
function tagCls(tag: string) {
  return TAG_COLORS[tag] ?? 'bg-indigo-50 text-indigo-700 border-indigo-100'
}

function TabResumen({ user, allTags }: { user: UserProfile; allTags: string[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Section title="Información personal">
        <Row label="Nombre">{user.name}</Row>
        <Row label="Email"><span className="flex items-center gap-1"><Mail size={13} />{user.email}</span></Row>
        <Row label="Teléfono"><span className="flex items-center gap-1"><Phone size={13} />{user.phone || '—'}</span></Row>
        <Row label="Rol">
          <Badge
            label={user.role === 'PARTNER' ? 'Socio' : user.role === 'ADMIN' ? 'Admin' : 'Cliente'}
            cls={user.role === 'PARTNER' ? 'bg-purple-100 text-purple-800' : user.role === 'ADMIN' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}
          />
        </Row>
        <Row label="Estado"><Badge label={user.isActive ? 'Activo' : 'Inactivo'} cls={user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'} /></Row>
        <Row label="Registro">{fmt(user.createdAt)}</Row>
        <Row label="Última actualiz.">{fmt(user.updatedAt)}</Row>
        <Row label="MP Customer ID"><span className="font-mono text-xs">{user.mercadopagoCustomerId || '—'}</span></Row>
      </Section>

      <Section title="Notificaciones">
        <Row label="Push"><NotifBadge enabled={user.notificationsPushEnabled} /></Row>
        <Row label="Email"><NotifBadge enabled={user.notificationsEmailEnabled} /></Row>
        <Row label="WhatsApp"><NotifBadge enabled={user.notificationsWhatsappEnabled} /></Row>
        <Row label="SMS"><NotifBadge enabled={user.notificationsSmsEnabled} /></Row>
      </Section>

      {user.role === 'CLIENT' && (
        <Section title="Métricas como cliente">
          <Row label="Calificación promedio">
            <span className="flex items-center gap-1 font-semibold">
              <Star size={14} className="text-yellow-500 fill-yellow-400" />
              {user.clientRating.toFixed(1)}
              <span className="text-gray-400 text-xs">({user.clientTotalReviews} reseñas)</span>
            </span>
          </Row>
          <Row label="Servicios completados">{user.completedServicesCount}</Row>
        </Section>
      )}

      {allTags.length > 0 && (
        <Section title="Etiquetas del chat">
          <div className="px-5 py-3 flex flex-wrap gap-2">
            {allTags.map(tag => (
              <span key={tag} className={`px-3 py-1 rounded-full text-xs font-semibold border ${tagCls(tag)}`}>{tag}</span>
            ))}
          </div>
        </Section>
      )}

      <Section title={`Direcciones (${user.addresses.length})`} empty={user.addresses.length === 0}>
        {user.addresses.length === 0 ? 'Sin direcciones registradas' : null}
        {user.addresses.map(addr => (
          <div key={addr.id} className="px-5 py-3">
            <div className="flex items-center gap-2 mb-0.5">
              <MapPin size={13} className="text-gray-400" />
              <span className="font-medium text-sm">{addr.label || `${addr.city}`}</span>
              {addr.isPrimary && <Badge label="Principal" cls="bg-blue-100 text-blue-700" />}
              {!addr.isActive && <Badge label="Inactiva" cls="bg-gray-100 text-gray-500" />}
            </div>
            <p className="text-xs text-gray-500 ml-5">
              {addr.street} {addr.number}{addr.complement ? `, ${addr.complement}` : ''}, {addr.neighborhood}, {addr.city} {addr.postalCode}
            </p>
            {addr.instructions && <p className="text-xs text-gray-400 ml-5 mt-0.5 italic">{addr.instructions}</p>}
          </div>
        ))}
      </Section>
    </div>
  )
}

function NotifBadge({ enabled }: { enabled: boolean }) {
  return enabled
    ? <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><CheckCircle size={13} /> Activo</span>
    : <span className="flex items-center gap-1 text-gray-400 text-xs"><XCircle size={13} /> Desactivado</span>
}

// ── Tab: Reservas ─────────────────────────────────────────────────────────────

function TabReservas({ bookings, isPartner, partnerBookings }: { bookings: Booking[]; isPartner: boolean; partnerBookings?: PartnerBooking[] }) {
  return (
    <div className="space-y-5">
      <BookingTable title={`Reservas como cliente (${bookings.length})`} bookings={bookings} mode="client" />
      {isPartner && partnerBookings && (
        <BookingTable title={`Reservas como socio (${partnerBookings.length})`} bookings={partnerBookings} mode="partner" />
      )}
    </div>
  )
}

function BookingTable({ title, bookings, mode }: { title: string; bookings: any[]; mode: 'client' | 'partner' }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">{title}</h3>
      </div>
      {bookings.length === 0 ? (
        <p className="p-5 text-sm text-gray-400">Sin reservas</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Servicio</th>
                <th className="px-4 py-2 text-left">{mode === 'client' ? 'Socio' : 'Cliente'}</th>
                <th className="px-4 py-2 text-left">Fecha</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2 text-right">Monto</th>
                <th className="px-4 py-2 text-left">Reseña</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {bookings.map((b: any) => {
                const st = BOOKING_STATUS[b.status] ?? { label: b.status, cls: 'bg-gray-100 text-gray-600' }
                return (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{b.service?.name || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {mode === 'client'
                        ? (b.partner?.user?.name || '—')
                        : (b.user?.name || '—')}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{fmt(b.scheduledDate)}<br /><span className="text-xs">{b.scheduledTime}</span></td>
                    <td className="px-4 py-2.5"><Badge label={st.label} cls={st.cls} /></td>
                    <td className="px-4 py-2.5 text-right font-medium">{currency(b.totalPrice)}</td>
                    <td className="px-4 py-2.5">
                      {b.review?.clientToPartnerRating ? (
                        <span className="flex items-center gap-1 text-xs">
                          <Star size={11} className="text-yellow-500 fill-yellow-400" />
                          {b.review.clientToPartnerRating}/5
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Tab: Conversaciones ───────────────────────────────────────────────────────

function TabConversaciones({ conversations }: { conversations: Conversation[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const allNotes = conversations.flatMap(c =>
    c.messages.map(n => ({ ...n, conversationId: c.id, channel: c.channel }))
  ).sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())

  return (
    <div className="space-y-5">
      {/* Notas internas consolidadas */}
      {allNotes.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-200">
            <h3 className="font-semibold text-amber-800 text-sm uppercase tracking-wide">Notas internas ({allNotes.length})</h3>
          </div>
          <div className="divide-y divide-amber-100">
            {allNotes.map(note => (
              <div key={note.id} className="px-5 py-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.body}</p>
                    <p className="text-xs text-amber-600 mt-1">
                      {note.sentBy?.name ?? 'Admin'} · {fmtDateTime(note.sentAt)} · {note.channel}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de conversaciones */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Conversaciones ({conversations.length})</h3>
        </div>
        {conversations.length === 0 ? (
          <p className="p-5 text-sm text-gray-400">Sin conversaciones</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {conversations.map(c => {
              const st = CONV_STATUS[c.status] ?? { label: c.status, cls: 'bg-gray-100 text-gray-600' }
              const isOpen = expanded === c.id
              return (
                <div key={c.id}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : c.id)}
                    className="w-full px-5 py-3 flex items-start gap-3 hover:bg-gray-50 text-left"
                  >
                    <MessageSquare size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold uppercase text-gray-500">{c.channel}</span>
                        <Badge label={st.label} cls={st.cls} />
                        {c.unreadCount > 0 && (
                          <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{c.unreadCount}</span>
                        )}
                        {c.tags.map(tag => (
                          <span key={tag} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${tagCls(tag)}`}>{tag}</span>
                        ))}
                        {c.messages.length > 0 && (
                          <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            {c.messages.length} nota{c.messages.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 truncate mt-0.5">{c.lastMessageBody || '—'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{c._count.messages} mensajes · {c.contactPhone} · {fmtDateTime(c.lastMessageAt)}</p>
                    </div>
                    <a
                      href={`/admin/inbox?conversationId=${c.id}`}
                      onClick={e => e.stopPropagation()}
                      className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Abrir en bandeja"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </button>

                  {/* Notas de esta conversación */}
                  {isOpen && c.messages.length > 0 && (
                    <div className="mx-5 mb-3 rounded-xl border border-amber-200 bg-amber-50 divide-y divide-amber-100 overflow-hidden">
                      {c.messages.map(note => (
                        <div key={note.id} className="px-4 py-2.5">
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.body}</p>
                          <p className="text-xs text-amber-600 mt-1">{note.sentBy?.name ?? 'Admin'} · {fmtDateTime(note.sentAt)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {isOpen && c.messages.length === 0 && (
                    <p className="px-5 pb-3 text-xs text-gray-400">Sin notas internas en esta conversación.</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab: Pagos ────────────────────────────────────────────────────────────────

function TabPagos({ payments }: { payments: Payment[] }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Pagos ({payments.length})</h3>
      </div>
      {payments.length === 0 ? (
        <p className="p-5 text-sm text-gray-400">Sin pagos</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Servicio</th>
                <th className="px-4 py-2 text-left">Método</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2 text-right">Monto</th>
                <th className="px-4 py-2 text-left">Fecha</th>
                <th className="px-4 py-2 text-left">MP ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payments.map(p => {
                const st = PAYMENT_STATUS[p.status] ?? { label: p.status, cls: 'bg-gray-100 text-gray-600' }
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-700">{p.booking?.service?.name || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{p.paymentMethodType || '—'}</td>
                    <td className="px-4 py-2.5"><Badge label={st.label} cls={st.cls} /></td>
                    <td className="px-4 py-2.5 text-right font-semibold">{currency(p.totalAmount)}</td>
                    <td className="px-4 py-2.5 text-gray-500">{fmt(p.paidAt || p.createdAt)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{p.mercadopagoId || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Tab: Soporte ──────────────────────────────────────────────────────────────

function TabSoporte({ cases }: { cases: SupportCase[] }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Casos de soporte ({cases.length})</h3>
      </div>
      {cases.length === 0 ? (
        <p className="p-5 text-sm text-gray-400">Sin casos de soporte</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {cases.map(c => (
            <div key={c.id} className="px-5 py-3">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-medium text-sm text-gray-800">{c.subject}</span>
                <Badge label={c.priority} cls={PRIORITY_CLS[c.priority] ?? 'bg-gray-100 text-gray-600'} />
                <Badge label={c.status} cls={c.status === 'OPEN' ? 'bg-blue-100 text-blue-700' : c.status === 'RESOLVED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'} />
                {c.queue && <span className="text-xs text-gray-400">{c.queue}</span>}
              </div>
              <p className="text-xs text-gray-400">{fmt(c.createdAt)}{c.resolvedAt ? ` → resuelto ${fmt(c.resolvedAt)}` : ''}</p>
              {c.resolutionNote && <p className="text-xs text-gray-500 mt-1 italic">{c.resolutionNote}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab: Actividad ────────────────────────────────────────────────────────────

function TabActividad({ fraudSignals, magicTokens, optOuts }: { fraudSignals: FraudSignal[]; magicTokens: MagicToken[]; optOuts: OptOut[] }) {
  return (
    <div className="space-y-5">
      {/* Fraud signals */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Señales de fraude ({fraudSignals.length})</h3>
        </div>
        {fraudSignals.length === 0 ? (
          <p className="p-5 text-sm text-gray-400">Sin señales de fraude</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {fraudSignals.map(f => (
              <div key={f.id} className="px-5 py-3 flex items-start gap-3">
                <AlertTriangle size={15} className={f.severity === 'CRITICAL' || f.severity === 'HIGH' ? 'text-red-500 mt-0.5' : 'text-yellow-500 mt-0.5'} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{f.type}</span>
                    <Badge label={f.severity} cls={SEVERITY_CLS[f.severity] ?? 'bg-gray-100 text-gray-600'} />
                    {f.status === 'CLOSED' && <Badge label="Resuelto" cls="bg-green-100 text-green-700" />}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{f.reason}</p>
                  {f.details && <p className="text-xs text-gray-400 mt-0.5">{f.details}</p>}
                  <p className="text-xs text-gray-400">{fmtDateTime(f.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Magic tokens */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Tokens mágicos recientes ({magicTokens.length})</h3>
        </div>
        {magicTokens.length === 0 ? (
          <p className="p-5 text-sm text-gray-400">Sin tokens</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {magicTokens.map(t => {
              const expired = new Date(t.expiresAt) < new Date()
              return (
                <div key={t.id} className="px-5 py-3 flex items-center gap-3">
                  <Key size={14} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-gray-500 truncate">{t.redirectUrl || '—'}</p>
                    <p className="text-xs text-gray-400">
                      Creado {fmtDateTime(t.createdAt)} · Vence {fmtDateTime(t.expiresAt)}
                      {t.usedAt ? ` · Usado ${fmtDateTime(t.usedAt)}` : ''}
                    </p>
                  </div>
                  <Badge
                    label={t.usedAt ? 'Usado' : expired ? 'Expirado' : 'Válido'}
                    cls={t.usedAt ? 'bg-gray-100 text-gray-500' : expired ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Opt-outs */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Opt-outs de mensajería ({optOuts.length})</h3>
        </div>
        {optOuts.length === 0 ? (
          <p className="p-5 text-sm text-gray-400">Sin opt-outs</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {optOuts.map(o => (
              <div key={o.id} className="px-5 py-3 flex items-center gap-3">
                <XCircle size={14} className={o.isActive ? 'text-red-500' : 'text-gray-300'} />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-700">{o.channel}</span>
                  <span className="text-gray-400 text-sm"> · {o.destination}</span>
                </div>
                <Badge label={o.isActive ? 'Activo' : 'Revocado'} cls={o.isActive ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'} />
                <span className="text-xs text-gray-400">{fmt(o.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab: Socio (partner-only) ─────────────────────────────────────────────────

function TabSocio({ profile }: { profile: PartnerProfile }) {
  return (
    <div className="space-y-5">
      {/* Basic partner info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title="Información del socio">
          <Row label="Encabezado">{profile.profileHeadline || '—'}</Row>
          <Row label="Bio">{profile.bio || '—'}</Row>
          <Row label="Ciudad">{profile.city || '—'}</Row>
          <Row label="Slug"><span className="font-mono text-xs">{profile.slug || '—'}</span></Row>
          <Row label="Perfil público"><Badge label={profile.isPublicProfile ? 'Sí' : 'No'} cls={profile.isPublicProfile ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'} /></Row>
          <Row label="Verificado"><Badge label={profile.verified ? 'Sí' : 'No'} cls={profile.verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'} /></Row>
          <Row label="Activo"><Badge label={profile.isActive ? 'Sí' : 'No'} cls={profile.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} /></Row>
          <Row label="Disponible"><Badge label={profile.isAvailable ? 'Sí' : 'No'} cls={profile.isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'} /></Row>
          <Row label="Registro">{fmt(profile.createdAt)}</Row>
        </Section>

        <Section title="Métricas">
          <Row label="Calificación">
            <span className="flex items-center gap-1 font-semibold">
              <Star size={14} className="text-yellow-500 fill-yellow-400" />
              {profile.rating.toFixed(1)}
              <span className="text-gray-400 text-xs">({profile.totalReviews} reseñas)</span>
            </span>
          </Row>
          <Row label="Servicios completados">{profile.completedServicesCount}</Row>
        </Section>
      </div>

      {/* Services */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Servicios ofrecidos ({profile.services.length})</h3>
        </div>
        {profile.services.length === 0 ? (
          <p className="p-5 text-sm text-gray-400">Sin servicios</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {profile.services.map(s => (
              <div key={s.id} className="px-5 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Package size={14} className="text-gray-400" />
                  <span className="font-medium text-sm">{s.service.name}</span>
                  <Badge label={s.isActive ? 'Activo' : 'Inactivo'} cls={s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'} />
                  <Badge label={s.isAvailable ? 'Disponible' : 'No disponible'} cls={s.isAvailable ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'} />
                  {s.basePrice != null && <span className="text-xs text-gray-500">Base: {currency(s.basePrice)}</span>}
                </div>
                {s.documents.length > 0 && (
                  <div className="mt-1.5 ml-5 flex flex-wrap gap-1">
                    {s.documents.map(d => {
                      const ds = DOC_STATUS[d.status] ?? { label: d.status, cls: 'bg-gray-100 text-gray-600' }
                      return <Badge key={d.id} label={`${d.type}: ${ds.label}`} cls={ds.cls} />
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Documentos ({profile.documents.length})</h3>
        </div>
        {profile.documents.length === 0 ? (
          <p className="p-5 text-sm text-gray-400">Sin documentos</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {profile.documents.map(d => {
              const ds = DOC_STATUS[d.status] ?? { label: d.status, cls: 'bg-gray-100 text-gray-600' }
              return (
                <div key={d.id} className="px-5 py-3 flex items-center gap-3">
                  <FileText size={14} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{d.type}</span>
                      <Badge label={ds.label} cls={ds.cls} />
                    </div>
                    {d.rejectionReason && <p className="text-xs text-red-500 mt-0.5">{d.rejectionReason}</p>}
                    <p className="text-xs text-gray-400">{fmt(d.createdAt)}{d.reviewedAt ? ` · revisado ${fmt(d.reviewedAt)}` : ''}</p>
                  </div>
                  <a href={d.documentUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                    <ExternalLink size={13} />
                  </a>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bank accounts */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Cuentas bancarias ({profile.bankAccounts.length})</h3>
        </div>
        {profile.bankAccounts.length === 0 ? (
          <p className="p-5 text-sm text-gray-400">Sin cuentas bancarias</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {profile.bankAccounts.map(b => (
              <div key={b.id} className="px-5 py-3">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <Building2 size={14} className="text-gray-400" />
                  <span className="font-medium text-sm">{b.bankName}</span>
                  <Badge label={b.accountType} cls="bg-gray-100 text-gray-600" />
                  {b.isDefault && <Badge label="Principal" cls="bg-blue-100 text-blue-700" />}
                  {!b.isActive && <Badge label="Inactiva" cls="bg-red-100 text-red-600" />}
                  {b.verifiedAt && <Badge label="Verificada" cls="bg-green-100 text-green-700" />}
                </div>
                <p className="text-xs text-gray-500 ml-5">{b.accountHolderName} · {b.holderDocumentType} {b.holderDocumentNumber}</p>
                <p className="text-xs font-mono text-gray-400 ml-5">****{b.accountNumber.slice(-4)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payouts */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Pagos a socio ({profile.payouts.length})</h3>
        </div>
        {profile.payouts.length === 0 ? (
          <p className="p-5 text-sm text-gray-400">Sin pagos</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Servicio</th>
                  <th className="px-4 py-2 text-right">Monto bruto</th>
                  <th className="px-4 py-2 text-right">Comisión</th>
                  <th className="px-4 py-2 text-right">Neto</th>
                  <th className="px-4 py-2 text-left">Estado</th>
                  <th className="px-4 py-2 text-left">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {profile.payouts.map(p => {
                  const st = PAYOUT_STATUS[p.status] ?? { label: p.status, cls: 'bg-gray-100 text-gray-600' }
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-700">{p.payment?.booking?.service?.name || '—'}</td>
                      <td className="px-4 py-2.5 text-right">{currency(p.amount)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{currency(p.partnerCommission)} ({p.partnerCommissionRate}%)</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-green-700">{currency(p.netAmount)}</td>
                      <td className="px-4 py-2.5"><Badge label={st.label} cls={st.cls} /></td>
                      <td className="px-4 py-2.5 text-gray-500">{fmt(p.processedAt || p.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Achievements */}
      {profile.achievements.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Logros ({profile.achievements.length})</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-5">
            {profile.achievements.map(a => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                <span className="text-2xl">{a.achievement.icon || '🏆'}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{a.achievement.name}</p>
                  <p className="text-xs text-gray-500">{a.achievement.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{fmt(a.unlockedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Work photos */}
      {profile.workPhotos.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Fotos de trabajo ({profile.workPhotos.length})</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-5">
            {profile.workPhotos.map(p => (
              <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="group block rounded-xl overflow-hidden border border-gray-200">
                <img src={p.url} alt={p.caption || 'Foto'} className="w-full h-28 object-cover group-hover:opacity-90 transition-opacity" />
                {p.caption && <p className="px-2 py-1 text-xs text-gray-500 truncate">{p.caption}</p>}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

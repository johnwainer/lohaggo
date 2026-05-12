'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Upload, FileText, CheckCircle, XCircle, Clock, Shield,
  GraduationCap, CreditCard, AlertCircle, Trash2, Eye, ChevronRight, Plus
} from 'lucide-react'
import Modal from '@/components/Modal'
import AccountTopHeader from '@/components/shared/AccountTopHeader'

interface Document {
  id: string
  type: string
  documentUrl: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectionReason?: string
  createdAt: string
  reviewedAt?: string
  partnerServiceId?: string | null
}

interface PartnerService {
  id: string
  service: { name: string; icon: string }
}

const DOCUMENT_TYPES = {
  IDENTITY: [
    { value: 'CEDULA_CIUDADANIA', label: 'Cédula de Ciudadanía' },
    { value: 'CEDULA_EXTRANJERIA', label: 'Cédula de Extranjería' },
    { value: 'PASAPORTE', label: 'Pasaporte' },
    { value: 'PEP', label: 'PEP (Permiso Especial de Permanencia)' }
  ],
  EDUCATION: [
    { value: 'DIPLOMA_BACHILLERATO', label: 'Diploma de Bachillerato' },
    { value: 'DIPLOMA_TECNICO', label: 'Diploma Técnico' },
    { value: 'DIPLOMA_TECNOLOGO', label: 'Diploma Tecnólogo' },
    { value: 'DIPLOMA_PROFESIONAL', label: 'Diploma Profesional' },
    { value: 'DIPLOMA_POSGRADO', label: 'Diploma de Posgrado' },
    { value: 'CERTIFICADO_CURSO', label: 'Certificado de Curso' }
  ]
}

function getDocumentLabel(type: string) {
  const all = [...DOCUMENT_TYPES.IDENTITY, ...DOCUMENT_TYPES.EDUCATION]
  return all.find(t => t.value === type)?.label || type
}

export default function VerificationPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<'IDENTITY' | 'EDUCATION'>('IDENTITY')
  const [selectedType, setSelectedType] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [partnerServices, setPartnerServices] = useState<PartnerService[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [linkingDocId, setLinkingDocId] = useState<string | null>(null)
  const [bookingsCount, setBookingsCount] = useState(0)
  const [requestsCount, setRequestsCount] = useState(0)

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'PARTNER') {
      router.push('/')
    }
  }, [session, status, router])

  useEffect(() => {
    fetchDocuments()
    fetchCounts()
    fetchPartnerServices()
  }, [])

  const fetchCounts = async () => {
    try {
      const [bookingsRes, requestsRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/partner/service-requests')
      ])
      if (bookingsRes.ok) {
        const d = await bookingsRes.json()
        setBookingsCount(Array.isArray(d) ? d.length : 0)
      }
      if (requestsRes.ok) {
        const d = await requestsRes.json()
        setRequestsCount(Array.isArray(d) ? d.length : 0)
      }
    } catch { /* silent */ }
  }

  const fetchPartnerServices = async () => {
    try {
      const res = await fetch('/api/partner/services')
      if (res.ok) {
        const data = await res.json()
        setPartnerServices(
          (data.services ?? [])
            .filter((s: any) => s.isActive)
            .map((s: any) => ({ id: s.partnerServiceId, service: { name: s.name, icon: s.icon } }))
        )
      }
    } catch { /* silent */ }
  }

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/partner/documents')
      if (res.ok) setDocuments(await res.json())
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }

  const openUploadFor = (category: 'IDENTITY' | 'EDUCATION') => {
    setSelectedCategory(category)
    setSelectedType('')
    setSelectedServiceId('')
    setSelectedFile(null)
    setPreviewUrl(null)
    setShowUploadModal(true)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setPreviewUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleUpload = async () => {
    if (!selectedFile || !selectedType) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('type', selectedType)
      if (selectedServiceId) formData.append('partnerServiceId', selectedServiceId)
      const res = await fetch('/api/partner/documents', { method: 'POST', body: formData })
      if (res.ok) {
        await fetchDocuments()
        setShowUploadModal(false)
        setSelectedFile(null)
        setPreviewUrl(null)
        setSelectedType('')
      }
    } catch { /* silent */ } finally {
      setUploading(false)
    }
  }

  const handleLinkService = async (documentId: string, partnerServiceId: string) => {
    setLinkingDocId(documentId)
    try {
      const res = await fetch('/api/partner/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, partnerServiceId: partnerServiceId || null }),
      })
      if (res.ok) await fetchDocuments()
    } catch { /* silent */ } finally {
      setLinkingDocId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este documento?')) return
    try {
      const res = await fetch(`/api/partner/documents?id=${id}`, { method: 'DELETE' })
      if (res.ok) await fetchDocuments()
    } catch { /* silent */ }
  }

  // Derived state per category
  const identityDocs = documents.filter(d => DOCUMENT_TYPES.IDENTITY.some(t => t.value === d.type))
  const educationDocs = documents.filter(d => DOCUMENT_TYPES.EDUCATION.some(t => t.value === d.type))
  const backgroundDoc = documents.find(d => d.type === 'ANTECEDENTES')

  const identityApproved = identityDocs.some(d => d.status === 'APPROVED')
  const identityPending = !identityApproved && identityDocs.some(d => d.status === 'PENDING')
  const identityRejected = !identityApproved && !identityPending && identityDocs.some(d => d.status === 'REJECTED')

  const educationApproved = educationDocs.some(d => d.status === 'APPROVED')
  const educationPending = !educationApproved && educationDocs.some(d => d.status === 'PENDING')
  const educationRejected = !educationApproved && !educationPending && educationDocs.some(d => d.status === 'REJECTED')

  const backgroundApproved = backgroundDoc?.status === 'APPROVED'
  const backgroundPending = backgroundDoc?.status === 'PENDING'

  const stepsCompleted = [identityApproved, educationApproved, backgroundApproved].filter(Boolean).length

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="account-shell">
      <AccountTopHeader
        role="PARTNER"
        title="Verificación"
        subtitle="Completa los 3 pasos para activar tu perfil"
        counts={{ bookings: bookingsCount, requests: requestsCount }}
      />

      <main className="account-main max-w-2xl">

        {/* Progress bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-gray-700">Progreso de verificación</span>
            <span className={`text-sm font-bold ${stepsCompleted === 3 ? 'text-green-600' : 'text-gray-500'}`}>
              {stepsCompleted} / 3 completados
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className="bg-green-500 rounded-full h-2.5 transition-all duration-500"
              style={{ width: `${(stepsCompleted / 3) * 100}%` }}
            />
          </div>
          {stepsCompleted === 3 && (
            <p className="text-xs text-green-600 font-semibold mt-2 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> ¡Perfil completamente verificado!
            </p>
          )}
        </div>

        {/* Step cards */}
        <div className="space-y-3 mb-6">
          <StepCard
            step={1}
            icon={<CreditCard className="w-5 h-5" />}
            iconColor="text-blue-600"
            title="Identificación"
            description="Cédula, pasaporte o documento oficial"
            approved={identityApproved}
            pending={identityPending}
            rejected={identityRejected}
            rejectionReason={identityDocs.find(d => d.status === 'REJECTED')?.rejectionReason}
            onUpload={() => openUploadFor('IDENTITY')}
          />
          <StepCard
            step={2}
            icon={<GraduationCap className="w-5 h-5" />}
            iconColor="text-purple-600"
            title="Educación"
            description="Diploma, título o certificado de curso"
            approved={educationApproved}
            pending={educationPending}
            rejected={educationRejected}
            rejectionReason={educationDocs.find(d => d.status === 'REJECTED')?.rejectionReason}
            onUpload={() => openUploadFor('EDUCATION')}
          />
          <StepCard
            step={3}
            icon={<Shield className="w-5 h-5" />}
            iconColor="text-green-600"
            title="Antecedentes"
            description="Verificado por el equipo de LoHaggo"
            approved={backgroundApproved}
            pending={backgroundPending}
            adminManaged
          />
        </div>

        {/* Banner: education docs approved without service linked */}
        {(() => {
          const unlinked = educationDocs.filter(
            d => d.status === 'APPROVED' && !d.partnerServiceId && partnerServices.length > 0
          )
          if (!unlinked.length) return null
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-bold text-amber-800 flex items-center gap-1.5 mb-2">
                <GraduationCap className="w-4 h-4" />
                {unlinked.length === 1 ? 'Tienes un certificado aprobado sin servicio asignado' : `Tienes ${unlinked.length} certificados aprobados sin servicio asignado`}
              </p>
              <p className="text-xs text-amber-700 mb-3">Asígnalos a un servicio para que aparezcan en tu perfil.</p>
              <div className="space-y-2">
                {unlinked.map(doc => (
                  <div key={doc.id} className="flex items-center gap-2">
                    <span className="text-xs text-amber-900 font-medium flex-1 truncate">{getDocumentLabel(doc.type)}</span>
                    <select
                      defaultValue=""
                      onChange={e => e.target.value && handleLinkService(doc.id, e.target.value)}
                      disabled={linkingDocId === doc.id}
                      className="text-xs border border-amber-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                    >
                      <option value="">Seleccionar servicio…</option>
                      {partnerServices.map(ps => (
                        <option key={ps.id} value={ps.id}>{ps.service.icon} {ps.service.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Document list */}
        {documents.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700">Documentos subidos</span>
              <button
                onClick={() => openUploadFor('IDENTITY')}
                className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {documents.map((doc) => {
                const linkedService = doc.partnerServiceId
                  ? partnerServices.find(ps => ps.id === doc.partnerServiceId)
                  : null
                return (
                <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                  <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{getDocumentLabel(doc.type)}</p>
                    {linkedService && (
                      <p className="text-xs text-purple-600 font-medium mt-0.5 flex items-center gap-1">
                        <span>{linkedService.service.icon}</span>{linkedService.service.name}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">{new Date(doc.createdAt).toLocaleDateString('es-CO')}</p>
                    {doc.rejectionReason && (
                      <p className="text-xs text-red-500 mt-0.5">Razón: {doc.rejectionReason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {doc.status === 'APPROVED' && <span className="text-xs font-bold text-green-600 flex items-center gap-0.5"><CheckCircle className="w-3.5 h-3.5" /> Aprobado</span>}
                    {doc.status === 'PENDING' && <span className="text-xs font-bold text-yellow-600 flex items-center gap-0.5"><Clock className="w-3.5 h-3.5" /> Revisión</span>}
                    {doc.status === 'REJECTED' && <span className="text-xs font-bold text-red-600 flex items-center gap-0.5"><XCircle className="w-3.5 h-3.5" /> Rechazado</span>}
                    <button
                      onClick={() => window.open(`/api/documents/view/${doc.id}`, '_blank')}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {doc.status === 'PENDING' && (
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                )
              })}
            </div>
          </div>
        )}

        {documents.length === 0 && (
          <div className="text-center py-6 text-gray-400 text-sm">
            Aún no has subido ningún documento. Empieza por el paso 1.
          </div>
        )}
      </main>

      {/* Upload modal */}
      {showUploadModal && (
        <Modal title="Subir documento" onClose={() => setShowUploadModal(false)}>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
              <div className="flex gap-3">
                {(['IDENTITY', 'EDUCATION'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => { setSelectedCategory(cat); setSelectedType('') }}
                    className={`flex-1 px-4 py-3 rounded-xl border-2 transition-colors text-sm font-semibold flex items-center justify-center gap-2 ${
                      selectedCategory === cat
                        ? cat === 'IDENTITY' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-purple-600 bg-purple-50 text-purple-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {cat === 'IDENTITY' ? <CreditCard className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
                    {cat === 'IDENTITY' ? 'Identificación' : 'Educación'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de documento</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">Selecciona un tipo</option>
                {DOCUMENT_TYPES[selectedCategory].map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            {selectedCategory === 'EDUCATION' && partnerServices.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ¿A qué servicio aplica este certificado? <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                >
                  <option value="">Sin asignar por ahora</option>
                  {partnerServices.map(ps => (
                    <option key={ps.id} value={ps.id}>{ps.service.icon} {ps.service.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-400">Puedes asignarlo después desde esta pantalla.</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Archivo (PDF o imagen)</label>
              <input
                type="file"
                accept=".pdf,application/pdf,image/*"
                onChange={handleFileSelect}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">PDF o imagen (JPG, PNG). Máx. 10 MB.</p>
              {previewUrl && (
                <div className="mt-3">
                  {selectedFile?.type.startsWith('image/') ? (
                    <img src={previewUrl} alt="Vista previa" className="max-h-48 mx-auto rounded-lg object-contain border" />
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <span className="text-sm text-gray-600 truncate">{selectedFile?.name}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowUploadModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={!selectedFile || !selectedType || uploading}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Subiendo...</>
                ) : (
                  <><Upload className="w-4 h-4" /> Subir</>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Step card component ────────────────────────────────────────────────────
interface StepCardProps {
  step: number
  icon: React.ReactNode
  iconColor: string
  title: string
  description: string
  approved?: boolean
  pending?: boolean
  rejected?: boolean
  rejectionReason?: string
  adminManaged?: boolean
  onUpload?: () => void
}

function StepCard({ step, icon, iconColor, title, description, approved, pending, rejected, rejectionReason, adminManaged, onUpload }: StepCardProps) {
  const isClickable = !approved && !pending && !adminManaged
  const isRejected = rejected && !approved

  const borderClass = approved
    ? 'border-green-400 bg-green-50'
    : isRejected
      ? 'border-red-300 bg-red-50'
      : pending
        ? 'border-yellow-300 bg-yellow-50'
        : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'

  const content = (
    <div className={`flex items-center gap-4 rounded-xl border-2 p-4 transition-all ${borderClass} ${isClickable || isRejected ? 'cursor-pointer active:scale-[0.99]' : ''}`}>
      {/* Step number + icon */}
      <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${
        approved ? 'bg-green-100' : isRejected ? 'bg-red-100' : pending ? 'bg-yellow-100' : 'bg-gray-100'
      }`}>
        {approved
          ? <CheckCircle className="w-6 h-6 text-green-600" />
          : isRejected
            ? <XCircle className="w-6 h-6 text-red-500" />
            : pending
              ? <Clock className="w-6 h-6 text-yellow-500" />
              : <span className={iconColor}>{icon}</span>
        }
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-400">Paso {step}</span>
          {approved && <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Verificado</span>}
          {pending && <span className="text-xs font-bold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">En revisión</span>}
          {isRejected && <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">Rechazado</span>}
        </div>
        <p className="font-bold text-gray-900 text-sm mt-0.5">{title}</p>
        {isRejected && rejectionReason
          ? <p className="text-xs text-red-500 mt-0.5">Razón: {rejectionReason}</p>
          : <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        }
        {adminManaged && !approved && !pending && (
          <p className="text-xs text-gray-400 mt-0.5 italic">El equipo de LoHaggo lo gestiona</p>
        )}
      </div>

      {/* Right action */}
      <div className="flex-shrink-0">
        {approved && <CheckCircle className="w-5 h-5 text-green-500" />}
        {pending && <Clock className="w-5 h-5 text-yellow-400" />}
        {(isClickable || isRejected) && (
          <div className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg ${
            isRejected ? 'bg-red-100 text-red-600' : 'bg-blue-600 text-white'
          }`}>
            {isRejected ? 'Re-subir' : 'Subir'} <ChevronRight className="w-3.5 h-3.5" />
          </div>
        )}
        {adminManaged && !approved && !pending && <AlertCircle className="w-5 h-5 text-gray-300" />}
      </div>
    </div>
  )

  if (isClickable || isRejected) {
    return <button type="button" onClick={onUpload} className="w-full text-left">{content}</button>
  }
  return <div>{content}</div>
}

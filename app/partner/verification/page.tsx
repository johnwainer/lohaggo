'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Upload, FileText, CheckCircle, XCircle, Clock, Shield,
  GraduationCap, CreditCard, AlertCircle, Trash2, Eye, ChevronRight, Plus, Building2,
} from 'lucide-react'
import Modal from '@/components/Modal'
import ServiceIcon from '@/components/ServiceIcon'
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
  service: { name: string; slug: string; icon: string }
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

  // Company state
  const [isCompany, setIsCompany] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [companyNit, setCompanyNit] = useState('')
  const [savingCompany, setSavingCompany] = useState(false)
  const [companyMsg, setCompanyMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [uploadingCompanyDoc, setUploadingCompanyDoc] = useState(false)
  const [companyFile, setCompanyFile] = useState<File | null>(null)
  const [editingCompanyInfo, setEditingCompanyInfo] = useState(false)

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'PARTNER') {
      router.push('/')
    }
  }, [session, status, router])

  useEffect(() => {
    fetchDocuments()
    fetchCounts()
    fetchPartnerServices()
    fetchCompanyProfile()
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

  const fetchCompanyProfile = async () => {
    try {
      const res = await fetch('/api/partner/profile')
      if (res.ok) {
        const data = await res.json()
        setIsCompany(data.isCompany ?? false)
        setCompanyName(data.companyName ?? '')
        setCompanyNit(data.companyNit ?? '')
      }
    } catch { /* silent */ }
  }

  const saveCompanyInfo = async (newIsCompany?: boolean) => {
    setSavingCompany(true)
    setCompanyMsg(null)
    try {
      const res = await fetch('/api/partner/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isCompany: newIsCompany ?? isCompany,
          companyName,
          companyNit,
        }),
      })
      if (res.ok) {
        setCompanyMsg({ type: 'ok', text: 'Información guardada' })
        setTimeout(() => setCompanyMsg(null), 3000)
      } else {
        setCompanyMsg({ type: 'err', text: 'Error al guardar' })
      }
    } catch {
      setCompanyMsg({ type: 'err', text: 'Error al guardar' })
    } finally {
      setSavingCompany(false)
    }
  }

  const handleCompanyDocUpload = async () => {
    if (!companyFile) return
    setUploadingCompanyDoc(true)
    try {
      const formData = new FormData()
      formData.append('file', companyFile)
      formData.append('type', 'CAMARA_COMERCIO')
      const res = await fetch('/api/partner/documents', { method: 'POST', body: formData })
      if (res.ok) {
        await fetchDocuments()
        setCompanyFile(null)
        setCompanyMsg({ type: 'ok', text: 'Documento enviado — el equipo lo revisará pronto' })
        setTimeout(() => setCompanyMsg(null), 4000)
      }
    } catch { /* silent */ } finally {
      setUploadingCompanyDoc(false)
    }
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
  const companyDoc = documents.find(d => d.type === 'CAMARA_COMERCIO')
  const companyDocApproved = companyDoc?.status === 'APPROVED'
  const companyDocPending = companyDoc?.status === 'PENDING'
  const companyDocRejected = companyDoc?.status === 'REJECTED'

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

        {/* ── Company section ── */}
        <div className={`bg-white rounded-xl border overflow-hidden mb-5 ${!identityApproved ? 'border-gray-200 opacity-70' : 'border-gray-200'}`}>

          {/* Locked: identity not verified yet */}
          {!identityApproved && (
            <div className="px-4 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-500">¿Eres empresa?</p>
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Primero debes verificar tu identidad (Paso 1) para activar esta opción
                </p>
              </div>
            </div>
          )}

          {/* Verified state: read-only display (with optional edit) */}
          {identityApproved && isCompany && companyDocApproved ? (
            <div className="px-4 py-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">Empresa verificada</p>
                  <p className="text-xs text-gray-500">Tu empresa está registrada y activa en LoHaggo</p>
                </div>
                <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full shrink-0">
                  <CheckCircle className="w-3.5 h-3.5" /> Activa
                </span>
              </div>

              {editingCompanyInfo ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nombre de la empresa</label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={e => setCompanyName(e.target.value)}
                        placeholder="Ej. Servicios ABC S.A.S."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">NIT</label>
                      <input
                        type="text"
                        value={companyNit}
                        onChange={e => setCompanyNit(e.target.value)}
                        placeholder="Ej. 900123456-7"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => { await saveCompanyInfo(); setEditingCompanyInfo(false) }}
                      disabled={savingCompany}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                      {savingCompany ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditingCompanyInfo(false)}
                      className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition"
                    >
                      Cancelar
                    </button>
                  </div>
                  {companyMsg && (
                    <p className={`text-xs font-medium flex items-center gap-1 ${companyMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                      {companyMsg.type === 'ok' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      {companyMsg.text}
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                    <p className="text-xs text-gray-400 font-medium mb-0.5">Nombre de la empresa</p>
                    <p className="text-sm font-bold text-gray-900">{companyName || '—'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                    <p className="text-xs text-gray-400 font-medium mb-0.5">NIT</p>
                    <p className="text-sm font-bold text-gray-900">{companyNit || '—'}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 mt-3">
                {!editingCompanyInfo && (
                  <button
                    onClick={() => setEditingCompanyInfo(true)}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-semibold transition"
                  >
                    Editar información
                  </button>
                )}
                {companyDoc && (
                  <button
                    onClick={() => window.open(`/api/documents/view/${companyDoc.id}`, '_blank')}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 transition"
                  >
                    <Eye className="w-3.5 h-3.5" /> Ver Cámara de Comercio
                  </button>
                )}
              </div>
            </div>
          ) : identityApproved ? (
            <>
              {/* Header with toggle */}
              <div className="px-4 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">¿Eres empresa?</p>
                      <p className="text-xs text-gray-500">Activa esto si operas como empresa registrada</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !isCompany
                      setIsCompany(next)
                      saveCompanyInfo(next)
                    }}
                    disabled={savingCompany}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${isCompany ? 'bg-indigo-600' : 'bg-gray-200'}`}
                    aria-label="Soy empresa"
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${isCompany ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              {isCompany && (
                <div className="px-4 py-4 space-y-4">
                  {/* Company name + NIT */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nombre de la empresa</label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={e => setCompanyName(e.target.value)}
                        placeholder="Ej. Servicios ABC S.A.S."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">NIT</label>
                      <input
                        type="text"
                        value={companyNit}
                        onChange={e => setCompanyNit(e.target.value)}
                        placeholder="Ej. 900123456-7"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => saveCompanyInfo()}
                    disabled={savingCompany}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    {savingCompany ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                    Guardar información
                  </button>

                  {companyMsg && (
                    <p className={`text-xs font-medium flex items-center gap-1 ${companyMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                      {companyMsg.type === 'ok' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      {companyMsg.text}
                    </p>
                  )}

                  {/* Cámara de Comercio upload */}
                  <div className="border-t border-gray-100 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-bold text-gray-800">Cámara de Comercio</p>
                        <p className="text-xs text-gray-500">Sube el certificado de tu empresa para verificar el registro</p>
                      </div>
                      {companyDocPending && (
                        <span className="flex items-center gap-1 text-xs font-bold text-yellow-700 bg-yellow-50 border border-yellow-200 px-2.5 py-1 rounded-full">
                          <Clock className="w-3.5 h-3.5" /> En revisión
                        </span>
                      )}
                      {companyDocRejected && (
                        <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                          <XCircle className="w-3.5 h-3.5" /> Rechazado
                        </span>
                      )}
                    </div>

                    {companyDocRejected && companyDoc?.rejectionReason && (
                      <div className="mb-3 flex items-start gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-700">{companyDoc.rejectionReason}</p>
                      </div>
                    )}

                    {!companyDocPending && (
                      <div className="space-y-3">
                        <label className={`flex flex-col items-center justify-center w-full border-2 border-dashed rounded-xl py-5 px-4 cursor-pointer transition-colors ${companyFile ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/30'}`}>
                          <input
                            type="file"
                            accept=".pdf,application/pdf,image/*"
                            className="hidden"
                            onChange={e => setCompanyFile(e.target.files?.[0] ?? null)}
                          />
                          {companyFile ? (
                            <div className="text-center">
                              <FileText className="w-8 h-8 text-indigo-500 mx-auto mb-1" />
                              <p className="text-sm font-semibold text-indigo-700 truncate max-w-xs">{companyFile.name}</p>
                              <p className="text-xs text-indigo-500">Toca para cambiar</p>
                            </div>
                          ) : (
                            <div className="text-center">
                              <Upload className="w-7 h-7 text-gray-400 mx-auto mb-1" />
                              <p className="text-sm font-semibold text-gray-700">Arrastra o toca para seleccionar</p>
                              <p className="text-xs text-gray-400 mt-0.5">PDF o imagen · Máx. 10 MB</p>
                            </div>
                          )}
                        </label>
                        <button
                          onClick={handleCompanyDocUpload}
                          disabled={!companyFile || uploadingCompanyDoc}
                          className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                          {uploadingCompanyDoc ? (
                            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Subiendo…</>
                          ) : (
                            <><Upload className="w-4 h-4" /> Enviar para revisión</>
                          )}
                        </button>
                      </div>
                    )}

                    {companyDoc && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => window.open(`/api/documents/view/${companyDoc.id}`, '_blank')}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 transition"
                        >
                          <Eye className="w-3.5 h-3.5" /> Ver documento
                        </button>
                        {companyDocRejected && (
                          <button
                            onClick={() => handleDelete(companyDoc.id)}
                            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Eliminar y re-subir
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
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
                        <ServiceIcon slug={linkedService.service.slug} emoji={linkedService.service.icon} size="sm" />{linkedService.service.name}
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
              <label
                className={`flex flex-col items-center justify-center w-full border-2 border-dashed rounded-xl py-6 px-4 cursor-pointer transition-colors ${
                  selectedFile ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const file = e.dataTransfer.files[0]
                  if (file) handleFileSelect({ target: { files: [file] } } as any)
                }}
              >
                <input type="file" accept=".pdf,application/pdf,image/*" onChange={handleFileSelect} className="hidden" />
                {selectedFile ? (
                  <div className="text-center">
                    {selectedFile.type.startsWith('image/') && previewUrl ? (
                      <img src={previewUrl} alt="Vista previa" className="max-h-36 mx-auto rounded-lg object-contain mb-2" />
                    ) : (
                      <FileText className="w-10 h-10 text-blue-400 mx-auto mb-2" />
                    )}
                    <p className="text-sm font-semibold text-blue-700 truncate max-w-xs">{selectedFile.name}</p>
                    <p className="text-xs text-blue-500 mt-0.5">Toca para cambiar</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-gray-700">Arrastra aquí o toca para seleccionar</p>
                    <p className="text-xs text-gray-400 mt-1">PDF o imagen · Máx. 10 MB</p>
                  </div>
                )}
              </label>
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
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        {isRejected && rejectionReason && (
          <div className="mt-1.5 flex items-start gap-1.5 bg-red-100 rounded-lg px-2 py-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 font-medium">{rejectionReason}</p>
          </div>
        )}
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

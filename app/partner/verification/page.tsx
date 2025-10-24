'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Upload, FileText, CheckCircle, XCircle, Clock, Award, Shield,
  GraduationCap, CreditCard, AlertCircle, Trash2, Eye, Home, Package,
  Bell, Activity, Settings, MessageSquare
} from 'lucide-react'
import Modal from '@/components/Modal'

interface Document {
  id: string
  type: string
  documentUrl: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectionReason?: string
  createdAt: string
  reviewedAt?: string
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
  const [bookingsCount, setBookingsCount] = useState(0)
  const [requestsCount, setRequestsCount] = useState(0)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session?.user?.role !== 'PARTNER') {
      router.push('/')
    }
  }, [session, status, router])

  useEffect(() => {
    fetchDocuments()
    fetchCounts()
  }, [])

  const fetchCounts = async () => {
    try {
      const [bookingsRes, requestsRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/partner/service-requests')
      ])

      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json()
        setBookingsCount(Array.isArray(bookingsData) ? bookingsData.length : 0)
      }

      if (requestsRes.ok) {
        const requestsData = await requestsRes.json()
        setRequestsCount(Array.isArray(requestsData) ? requestsData.length : 0)
      }
    } catch (error) {
      console.error('Error fetching counts:', error)
    }
  }

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/partner/documents')
      if (res.ok) {
        const data = await res.json()
        setDocuments(data)
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !selectedType) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('type', selectedType)

      const res = await fetch('/api/partner/documents', {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        await fetchDocuments()
        setShowUploadModal(false)
        setSelectedFile(null)
        setPreviewUrl(null)
        setSelectedType('')
      }
    } catch (error) {
      console.error('Error uploading document:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este documento?')) return

    try {
      const res = await fetch(`/api/partner/documents?id=${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        await fetchDocuments()
      }
    } catch (error) {
      console.error('Error deleting document:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'REJECTED':
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'Aprobado'
      case 'REJECTED':
        return 'Rechazado'
      default:
        return 'En revisión'
    }
  }

  const [activeSubmenu, setActiveSubmenu] = React.useState<'all' | 'identity' | 'education'>('all')

  const getDocumentLabel = (type: string) => {
    const allTypes = [...DOCUMENT_TYPES.IDENTITY, ...DOCUMENT_TYPES.EDUCATION]
    return allTypes.find(t => t.value === type)?.label || type
  }

  const SubmenuNav = () => (
    <div className="mt-6 mb-4">
      <nav className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveSubmenu('all')}
          className={`px-3 py-2 text-sm font-medium rounded ${activeSubmenu === 'all' ? 'bg-primary-600 text-white' : 'text-gray-600 bg-white border'}`}
        >
          Todos
        </button>

        <button
          onClick={() => setActiveSubmenu('identity')}
          className={`px-3 py-2 text-sm font-medium rounded ${activeSubmenu === 'identity' ? 'bg-primary-600 text-white' : 'text-gray-600 bg-white border'}`}
        >
          Identidad
        </button>

        <button
          onClick={() => setActiveSubmenu('education')}
          className={`px-3 py-2 text-sm font-medium rounded ${activeSubmenu === 'education' ? 'bg-primary-600 text-white' : 'text-gray-600 bg-white border'}`}
        >
          Educación
        </button>
      </nav>
    </div>
  )

  const hasIdentityDoc = documents.some(d =>
    DOCUMENT_TYPES.IDENTITY.some(t => t.value === d.type) && d.status === 'APPROVED'
  )

  const hasEducationDoc = documents.some(d =>
    DOCUMENT_TYPES.EDUCATION.some(t => t.value === d.type) && d.status === 'APPROVED'
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Verificación de Documentos</h1>
                <p className="hidden sm:block text-sm text-gray-600">Sube tus documentos para verificar tu identidad y educación</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => router.push('/partner')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
              >
                <Home size={20} className="sm:w-[22px] sm:h-[22px]" />
                <span className="hidden sm:inline">Resumen</span>
              </button>

              <button
                onClick={() => router.push('/partner?tab=bookings')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
              >
                <Package size={20} className="sm:w-[22px] sm:h-[22px]" />
                <span className="hidden sm:inline">Mis Reservas</span>
                {bookingsCount > 0 && (
                  <span className="bg-primary-600 text-white text-[10px] px-2 py-0.5 rounded-full ml-2">
                    {bookingsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => router.push('/partner?tab=my-requests')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
              >
                <MessageSquare size={20} className="sm:w-[22px] sm:h-[22px]" />
                <span className="hidden sm:inline">Para Mí</span>
                {requestsCount > 0 && (
                  <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-2">
                    {requestsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => router.push('/partner?tab=all-requests')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
              >
                <Activity size={20} className="sm:w-[22px] sm:h-[22px]" />
                <span className="hidden sm:inline">Todas</span>
              </button>

              <button
                onClick={() => router.push('/partner/notifications')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
              >
                <Bell size={20} className="sm:w-[22px] sm:h-[22px]" />
                <span className="hidden sm:inline">Notificaciones</span>
              </button>

              <button
                onClick={() => router.push('/partner/services')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
              >
                <Settings size={20} className="sm:w-[22px] sm:h-[22px]" />
                <span className="hidden sm:inline">Mis Servicios</span>
              </button>

              <button
                onClick={() => router.push('/partner/verification')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-primary-600 text-primary-600 transition whitespace-nowrap"
              >
                <Shield size={20} className="sm:w-[22px] sm:h-[22px]" />
                <span className="hidden sm:inline">Verificación</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className={`bg-white rounded-lg shadow-md p-6 border-2 ${hasIdentityDoc ? 'border-green-500' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <CreditCard className="w-8 h-8 text-blue-600" />
              {hasIdentityDoc && <CheckCircle className="w-6 h-6 text-green-500" />}
            </div>
            <h3 className="text-lg font-semibold mb-2">Identificación</h3>
            <p className="text-sm text-gray-600">
              Verifica tu identidad con un documento oficial
            </p>
          </div>

          <div className={`bg-white rounded-lg shadow-md p-6 border-2 ${hasEducationDoc ? 'border-green-500' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <GraduationCap className="w-8 h-8 text-purple-600" />
              {hasEducationDoc && <CheckCircle className="w-6 h-6 text-green-500" />}
            </div>
            <h3 className="text-lg font-semibold mb-2">Educación</h3>
            <p className="text-sm text-gray-600">
              Comparte tus diplomas y certificados
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-2 border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <Shield className="w-8 h-8 text-green-600" />
              <AlertCircle className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Antecedentes</h3>
            <p className="text-sm text-gray-600">
              Verificado por el administrador
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Mis Documentos</h2>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Upload className="w-5 h-5" />
              Subir Documento
            </button>
          </div>

          {documents.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No has subido ningún documento aún</p>
            </div>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => (
                <div key={doc.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <FileText className="w-8 h-8 text-gray-400" />
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{getDocumentLabel(doc.type)}</h3>
                        <p className="text-sm text-gray-500">
                          Subido el {new Date(doc.createdAt).toLocaleDateString('es-CO')}
                        </p>
                        {doc.rejectionReason && (
                          <p className="text-sm text-red-600 mt-1">
                            Razón de rechazo: {doc.rejectionReason}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {doc.status === 'APPROVED' && (
                          <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                            <CheckCircle className="w-4 h-4" />
                            Aprobado
                          </span>
                        )}
                        {doc.status === 'REJECTED' && (
                          <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                            <XCircle className="w-4 h-4" />
                            Rechazado
                          </span>
                        )}
                        {doc.status === 'PENDING' && (
                          <span className="flex items-center gap-1 text-yellow-600 text-sm font-medium">
                            <Clock className="w-4 h-4" />
                            Pendiente
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => window.open(doc.documentUrl, '_blank')}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Ver documento"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar documento"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showUploadModal && (
        <Modal onClose={() => setShowUploadModal(false)}>
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Subir Documento</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoría
              </label>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setSelectedCategory('IDENTITY')
                    setSelectedType('')
                  }}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                    selectedCategory === 'IDENTITY'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <CreditCard className="w-6 h-6 mx-auto mb-2" />
                  <span className="font-medium">Identificación</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedCategory('EDUCATION')
                    setSelectedType('')
                  }}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                    selectedCategory === 'EDUCATION'
                      ? 'border-purple-600 bg-purple-50 text-purple-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <GraduationCap className="w-6 h-6 mx-auto mb-2" />
                  <span className="font-medium">Educación</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Documento
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecciona un tipo</option>
                {DOCUMENT_TYPES[selectedCategory].map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Archivo (Solo PDF)
              </label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">Solo se permiten archivos PDF</p>
              {previewUrl && (
                <div className="mt-4">
                  {selectedFile?.type.startsWith('image/') ? (
                    <img src={previewUrl} alt="Preview" className="max-h-64 mx-auto rounded-lg" />
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <FileText className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">{selectedFile?.name}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-4">
              <button
                onClick={() => setShowUploadModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={!selectedFile || !selectedType || uploading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {uploading ? 'Subiendo...' : 'Subir'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

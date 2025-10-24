'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  FileText, CheckCircle, XCircle, Clock, Eye, User, Mail, Phone,
  Filter, Search, CreditCard, GraduationCap, Shield, Upload
} from 'lucide-react'
import Modal from '@/components/Modal'
import { v2 as cloudinary } from 'cloudinary'

interface Document {
  id: string
  type: string
  documentUrl: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectionReason?: string
  createdAt: string
  reviewedAt?: string
  partner: {
    id: string
    user: {
      name: string
      email: string
      phone: string
    }
  }
}

const DOCUMENT_LABELS: Record<string, string> = {
  CEDULA_CIUDADANIA: 'Cédula de Ciudadanía',
  CEDULA_EXTRANJERIA: 'Cédula de Extranjería',
  PASAPORTE: 'Pasaporte',
  PEP: 'PEP',
  DIPLOMA_BACHILLERATO: 'Diploma de Bachillerato',
  DIPLOMA_TECNICO: 'Diploma Técnico',
  DIPLOMA_TECNOLOGO: 'Diploma Tecnólogo',
  DIPLOMA_PROFESIONAL: 'Diploma Profesional',
  DIPLOMA_POSGRADO: 'Diploma de Posgrado',
  CERTIFICADO_CURSO: 'Certificado de Curso',
  ANTECEDENTES: 'Antecedentes'
}

export default function AdminDocumentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [documents, setDocuments] = useState<Document[]>([])
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewAction, setReviewAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED')
  const [rejectionReason, setRejectionReason] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [showBackgroundModal, setShowBackgroundModal] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState<any>(null)
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null)
  const [uploadingBackground, setUploadingBackground] = useState(false)
  const [partners, setPartners] = useState<any[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session?.user?.role !== 'ADMIN') {
      router.push('/')
    }
  }, [session, status, router])

  useEffect(() => {
    fetchDocuments()
    fetchPartners()
  }, [])

  useEffect(() => {
    filterDocuments()
  }, [documents, statusFilter, searchTerm])

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/admin/documents')
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

  const fetchPartners = async () => {
    try {
      const res = await fetch('/api/admin/partners/list')
      if (res.ok) {
        const data = await res.json()
        setPartners(data)
      }
    } catch (error) {
      console.error('Error fetching partners:', error)
    }
  }

  const filterDocuments = () => {
    let filtered = documents

    if (statusFilter !== 'all') {
      filtered = filtered.filter(doc => doc.status === statusFilter)
    }

    if (searchTerm) {
      filtered = filtered.filter(doc =>
        doc.partner.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.partner.user.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredDocuments(filtered)
  }

  const handleReview = async () => {
    if (!selectedDocument) return
    if (reviewAction === 'REJECTED' && !rejectionReason.trim()) {
      alert('Debes proporcionar una razón de rechazo')
      return
    }

    setReviewing(true)
    try {
      const res = await fetch('/api/admin/documents/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocument.id,
          status: reviewAction,
          rejectionReason: reviewAction === 'REJECTED' ? rejectionReason : undefined
        })
      })

      if (res.ok) {
        await fetchDocuments()
        setShowReviewModal(false)
        setSelectedDocument(null)
        setRejectionReason('')
      }
    } catch (error) {
      console.error('Error reviewing document:', error)
    } finally {
      setReviewing(false)
    }
  }

  const handleUploadBackground = async () => {
    if (!backgroundFile || !selectedPartner) return

    setUploadingBackground(true)
    try {
      const formData = new FormData()
      formData.append('file', backgroundFile)
      formData.append('type', 'ANTECEDENTES')
      formData.append('partnerId', selectedPartner.id)

      const res = await fetch('/api/admin/documents/background', {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        await fetchDocuments()
        setShowBackgroundModal(false)
        setSelectedPartner(null)
        setBackgroundFile(null)
      }
    } catch (error) {
      console.error('Error uploading background check:', error)
    } finally {
      setUploadingBackground(false)
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

  const getStatusBadge = (status: string) => {
    const styles = {
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      PENDING: 'bg-yellow-100 text-yellow-800'
    }
    const labels = {
      APPROVED: 'Aprobado',
      REJECTED: 'Rechazado',
      PENDING: 'Pendiente'
    }
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  const getDocumentIcon = (type: string) => {
    if (['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP'].includes(type)) {
      return <CreditCard className="w-5 h-5 text-blue-600" />
    }
    if (type === 'ANTECEDENTES') {
      return <Shield className="w-5 h-5 text-green-600" />
    }
    return <GraduationCap className="w-5 h-5 text-purple-600" />
  }

  const pendingCount = documents.filter(d => d.status === 'PENDING').length

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestión de Documentos</h1>
          <p className="text-gray-600">
            Revisa y aprueba los documentos de verificación de los socios
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-600 font-medium">Pendientes</p>
                  <p className="text-2xl font-bold text-yellow-900">{pendingCount}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-600" />
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">Aprobados</p>
                  <p className="text-2xl font-bold text-green-900">
                    {documents.filter(d => d.status === 'APPROVED').length}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600 font-medium">Rechazados</p>
                  <p className="text-2xl font-bold text-red-900">
                    {documents.filter(d => d.status === 'REJECTED').length}
                  </p>
                </div>
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los estados</option>
              <option value="PENDING">Pendientes</option>
              <option value="APPROVED">Aprobados</option>
              <option value="REJECTED">Rechazados</option>
            </select>
            <button
              onClick={() => setShowBackgroundModal(true)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Shield className="w-5 h-5" />
              Subir Antecedentes
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No hay documentos para mostrar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Socio
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo de Documento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <User className="w-6 h-6 text-gray-600" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{doc.partner.user.name}</div>
                            <div className="text-sm text-gray-500">{doc.partner.user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getDocumentIcon(doc.type)}
                          <span className="text-sm text-gray-900">{DOCUMENT_LABELS[doc.type]}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(doc.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(doc.createdAt).toLocaleDateString('es-CO')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <a
                            href={doc.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Eye className="w-5 h-5" />
                          </a>
                          {doc.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedDocument(doc)
                                  setReviewAction('APPROVED')
                                  setShowReviewModal(true)
                                }}
                                className="text-green-600 hover:text-green-900"
                              >
                                <CheckCircle className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedDocument(doc)
                                  setReviewAction('REJECTED')
                                  setShowReviewModal(true)
                                }}
                                className="text-red-600 hover:text-red-900"
                              >
                                <XCircle className="w-5 h-5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showReviewModal && selectedDocument && (
        <Modal
          onClose={() => {
            setShowReviewModal(false)
            setSelectedDocument(null)
            setRejectionReason('')
          }}
          title={reviewAction === 'APPROVED' ? 'Aprobar Documento' : 'Rechazar Documento'}
        >
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-2">Socio</p>
              <p className="font-medium">{selectedDocument.partner.user.name}</p>
              <p className="text-sm text-gray-600">{selectedDocument.partner.user.email}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-2">Documento</p>
              <p className="font-medium">{DOCUMENT_LABELS[selectedDocument.type]}</p>
            </div>

            {reviewAction === 'REJECTED' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Razón del rechazo *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Explica por qué se rechaza este documento..."
                />
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button
                onClick={() => {
                  setShowReviewModal(false)
                  setSelectedDocument(null)
                  setRejectionReason('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleReview}
                disabled={reviewing || (reviewAction === 'REJECTED' && !rejectionReason.trim())}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed ${
                  reviewAction === 'APPROVED'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {reviewing ? 'Procesando...' : reviewAction === 'APPROVED' ? 'Aprobar' : 'Rechazar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showBackgroundModal && (
        <Modal
          onClose={() => {
            setShowBackgroundModal(false)
            setSelectedPartner(null)
            setBackgroundFile(null)
          }}
          title="Subir Antecedentes"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seleccionar Socio
              </label>
              <select
                value={selectedPartner?.id || ''}
                onChange={(e) => {
                  const partner = partners.find(p => p.id === e.target.value)
                  setSelectedPartner(partner)
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecciona un socio</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.user.name} - {partner.user.email}
                  </option>
                ))}
              </select>
            </div>

            {selectedPartner && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Socio seleccionado</p>
                <p className="font-medium">{selectedPartner.user.name}</p>
                <p className="text-sm text-gray-600">{selectedPartner.user.email}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Documento de Antecedentes
              </label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setBackgroundFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                onClick={() => {
                  setShowBackgroundModal(false)
                  setSelectedPartner(null)
                  setBackgroundFile(null)
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUploadBackground}
                disabled={!backgroundFile || !selectedPartner || uploadingBackground}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {uploadingBackground ? 'Subiendo...' : 'Subir'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
